import {
    findNodeData,
    ListNode,
    NodeAbstract,
    NodeType,
    RawNodeType,
} from '@md-to-latex/converter/dist/ast/node';

import { NodesByType, RawNodesByType } from '@md-to-latex/converter/dist/ast';
import { ProcessedNodeType } from '@md-to-latex/converter/dist/macro/node';
import { ProcessedNodesByType } from '@md-to-latex/converter/dist/macro';
import { DocxPrinter, PrinterVisitorResult } from '.';
import {
    DiagnoseErrorType,
    DiagnoseList,
    DiagnoseSeverity,
    nodeToDiagnose,
} from '@md-to-latex/converter/dist/diagnostic';
import * as docx from 'docx';
import { AlignmentType, Paragraph, TextRun, UnderlineType } from 'docx';
import {
    formulaNodeToPicture,
    getWordListItem,
    printFormulaProcessedNode,
    printKeyNode,
    printLazyNumberNode,
} from './printer';
import * as fs from 'fs';
import path from 'path';
import sizeOf from 'image-size';

// Editing

type AllNodesByType = RawNodesByType & NodesByType & ProcessedNodesByType;

export type DocxPrinterVisitor<T = NodeAbstract> = (
    printer: DocxPrinter,
    node: T,
) => Promise<PrinterVisitorResult>;

export type DocxPrinterVisitorList<T = NodeAbstract> = (
    printer: DocxPrinter,
    node: T[],
) => Promise<PrinterVisitorResult>;

export type ProcessingVisitors = {
    [Key in keyof AllNodesByType]: DocxPrinterVisitor<AllNodesByType[Key]>;
};

const unparsableNodeType: DocxPrinterVisitor = async (printer, node) => ({
    result: [new docx.TextRun({ text: 'Unparsable' })],
    diagnostic: [
        nodeToDiagnose(
            node,
            DiagnoseSeverity.Warning,
            DiagnoseErrorType.PrinterError,
            `Unable to print node with type '${node.type}'`,
        ),
    ],
});

const internalUnparsableNodeType: DocxPrinterVisitor = async (
    printer,
    node,
) => ({
    result: [new docx.TextRun({ text: 'InternalError' })],
    diagnostic: [
        nodeToDiagnose(
            node,
            DiagnoseSeverity.Warning,
            DiagnoseErrorType.PrinterError,
            `Unable to print node with type '${node.type}' (internal error)`,
        ),
    ],
});

const internalTODO: DocxPrinterVisitor = async (printer, node) => ({
    // result: [],
    result: [
        new docx.TextRun({
            text: `[TODO (inline) '${node.type}']`,
            color: 'FFFFFF',
            highlight: 'red',
            bold: true,
        }),
    ],
    diagnostic: [
        nodeToDiagnose(
            node,
            DiagnoseSeverity.Warning,
            DiagnoseErrorType.PrinterError,
            `Unable to print node with type '${node.type}' (TODO)`,
        ),
    ],
});
const internalTODOParagraph: DocxPrinterVisitor = async (printer, node) => ({
    result: [
        new docx.Paragraph({
            children: [
                new docx.TextRun({
                    text: `[TODO (paragraph) '${node.type}']`,
                    color: 'FFFFFF',
                    highlight: 'red',
                    bold: true,
                }),
            ],
        }),
    ],
    diagnostic: [
        nodeToDiagnose(
            node,
            DiagnoseSeverity.Warning,
            DiagnoseErrorType.PrinterError,
            `Unable to print node with type '${node.type}' (TODO par)`,
        ),
    ],
});

export const processingVisitors: ProcessingVisitors = {
    [RawNodeType.Raw]: internalUnparsableNodeType,
    [RawNodeType.Tokens]: internalUnparsableNodeType,
    [RawNodeType.SoftBreak]: internalUnparsableNodeType,
    [RawNodeType.ParagraphBreak]: internalUnparsableNodeType,
    [RawNodeType.TextBreak]: internalUnparsableNodeType,

    [NodeType.Code]: internalUnparsableNodeType,
    [ProcessedNodeType.CodeProcessed]: internalTODOParagraph,
    [NodeType.Heading]: async (printer, node) => {
        const diagnostic: DiagnoseList = [];
        const heading = (() => {
            // Starts with 1
            if (node.depth == 1) {
                return docx.HeadingLevel.HEADING_1;
            }
            if (node.depth == 2) {
                return docx.HeadingLevel.HEADING_2;
            }
            if (node.depth == 3) {
                return docx.HeadingLevel.HEADING_3;
            }
            if (node.depth == 4) {
                return docx.HeadingLevel.HEADING_4;
            }
            diagnostic.push(
                nodeToDiagnose(
                    node,
                    DiagnoseSeverity.Error,
                    DiagnoseErrorType.PrinterError,
                    `Unable to resolve heading level ${node.depth}`,
                ),
            );
            return docx.HeadingLevel.HEADING_6;
        })();

        const result = await printer.processNodeList(printer, node.children);
        return {
            result: [
                new docx.Paragraph({
                    heading,
                    children: [...result.result],
                }),
            ],
            diagnostic: [...result.diagnostic, ...diagnostic],
        };
    },

    [NodeType.Table]: internalUnparsableNodeType,

    // TODO: Table pack
    [ProcessedNodeType.TableProcessed]: internalTODOParagraph,

    [NodeType.Blockquote]: unparsableNodeType,
    [NodeType.List]: async (printer, node) =>
        await printer.processNodeList(printer, node.children),
    [NodeType.ListItem]: async (printer, node) => {
        let superparentList: null | ListNode = null;
        let parentList: null | ListNode = null;
        let parent = node.parent;
        let depth = 0;

        const diagnostic: DiagnoseList = [];

        // TODO: encapsulate (duplication with latex printer)
        while (parent !== null) {
            if (parent.type === NodeType.List) {
                parentList ??= parent as ListNode;
                superparentList = parent as ListNode;
                ++depth;
            }
            parent = parent.parent;
        }
        if (parentList === null || superparentList === null) {
            diagnostic.push(
                nodeToDiagnose(
                    node,
                    DiagnoseSeverity.Error,
                    DiagnoseErrorType.PrinterError,
                    'Cannot find List parent for ListItem (internal error)',
                ),
            );

            return {
                result: [],
                diagnostic,
            };
        }

        const index = findNodeData(node).index;
        const childrenResult = await printer.processNodeList(
            printer,
            node.children,
        );
        diagnostic.push(...childrenResult.diagnostic);

        const latexItemResult = await getWordListItem(
            printer,
            {
                xml: childrenResult.result,
                depth: depth,
                index: index,
                isOrdered: parentList.ordered,
            },
            node,
            superparentList,
        );
        return {
            result: latexItemResult.result,
            diagnostic,
        };
    },
    [NodeType.Paragraph]: async (printer, node) => {
        const result = await printer.processNodeList(printer, node.children);

        return {
            result: [
                new docx.Paragraph({
                    children: [...result.result],
                }),
            ],
            diagnostic: [...result.diagnostic],
        };
    },
    [NodeType.Escape]: internalTODO,
    [NodeType.Text]: async (printer, node) => {
        return {
            result: [
                new docx.TextRun({
                    text: node.text,
                }),
            ],
            diagnostic: [],
        };
    },
    [NodeType.Link]: internalTODO,
    [NodeType.Image]: internalUnparsableNodeType,
    [ProcessedNodeType.PictureProcessed]: async (printer, node) => {
        const diagnostic: DiagnoseList = [];

        // TODO(toliak): encapsulate
        const filePath = path.resolve(node.href.text);
        const errorPicture = () =>
            new docx.Paragraph({
                children: [
                    new docx.TextRun({
                        text: `Unknown picture ${filePath}`,
                        color: 'red',
                    }),
                ],
            });

        if (!filePath) {
            diagnostic.push(
                nodeToDiagnose(
                    node.href,
                    DiagnoseSeverity.Error,
                    DiagnoseErrorType.PrinterError,
                    `File '${filePath}' not found`,
                ),
            );
            return {
                result: [errorPicture()],
                diagnostic: [...diagnostic],
            };
        }

        const imageBuffer = fs.readFileSync(filePath);
        let width: number, height: number;
        try {
            const dimensions = await sizeOf(imageBuffer);
            if (!(dimensions.height && dimensions.width)) {
                throw new Error('just catch it, i dont want to copypast code');
            }
            [width, height] = [dimensions.width, dimensions.height];
        } catch (err) {
            diagnostic.push(
                nodeToDiagnose(
                    node.href,
                    DiagnoseSeverity.Error,
                    DiagnoseErrorType.PrinterError,
                    `File '${filePath}' unable to get size`,
                ),
            );
            return {
                result: [errorPicture()],
                diagnostic: [...diagnostic],
            };
        }

        const k = width / height;
        const cmToPx = (cm: number) => (cm / 2.54) * 96;
        const parseOrDefault = (
            value: string | undefined | null,
            def: number,
        ) => {
            if (!value) {
                return def;
            }
            return cmToPx(parseInt(value));
        };

        return {
            result: [
                new Paragraph({
                    children: [
                        new docx.ImageRun({
                            data: imageBuffer,
                            transformation: {
                                width: parseOrDefault(node.width, width),
                                height: parseOrDefault(node.height, height),
                            },
                        }),
                    ],
                    keepNext: true,
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new docx.TextRun({
                            text: `Рисунок ${node.index} – ${node.label.text}`,
                        }),
                    ],
                }),
            ],
            diagnostic: [...diagnostic],
        };
    },
    [NodeType.Strong]: async (printer, node) => {
        const result = await printer.processNodeList(printer, node.children);

        return {
            result: await Promise.all(
                result.result.map(
                    n =>
                        new TextRun({
                            children: [n],
                            bold: true,
                        }),
                ),
            ),
            diagnostic: [],
        };
    },
    [NodeType.Underline]: async (printer, node) => {
        const result = await printer.processNodeList(printer, node.children);

        return {
            result: await Promise.all(
                result.result.map(
                    n =>
                        new TextRun({
                            children: [n],
                            underline: {
                                type: UnderlineType.SINGLE,
                            },
                        }),
                ),
            ),
            diagnostic: [],
        };
    },
    // [NodeType.Em]: internalTODO,
    [NodeType.Em]: async (printer, node) => {
        const result = await printer.processNodeList(printer, node.children);

        return {
            result: await Promise.all(
                result.result.map(
                    n =>
                        new TextRun({
                            children: [n],
                            italics: true,
                        }),
                ),
            ),
            diagnostic: [],
        };
    },
    [NodeType.Hr]: async (printer, node) => {
        return {
            result: [new docx.Paragraph({ children: [new docx.PageBreak()] })],
            diagnostic: [],
        };
    },
    [NodeType.CodeSpan]: async (printer, node) => {
        return {
            result: [
                new docx.TextRun({
                    text: `«${node.text}»`,
                }),
            ],
            diagnostic: [],
        };
    },
    [NodeType.Br]: async (printer, node) => {
        return {
            result: [],
            diagnostic: [
                nodeToDiagnose(
                    node,
                    DiagnoseSeverity.Info,
                    DiagnoseErrorType.PrinterError,
                    'BR node prints into nothing',
                ),
            ],
        };
    },
    [NodeType.Del]: async (printer, node) => {
        const result = await printer.processNodeList(printer, node.children);

        return {
            result: await Promise.all(
                result.result.map(
                    n =>
                        new TextRun({
                            children: [n],
                            strike: true,
                        }),
                ),
            ),
            diagnostic: [],
        };
    },
    [NodeType.File]: async (printer, node) => {
        // TODO: if it is not a paragraph -> wrap over a paragraph
        // TODO: validate paragraphs in paragraphs
        const childrenResult = await printer.processNodeList(
            printer,
            node.children,
        );
        return {
            result: [...childrenResult.result],
            diagnostic: [...childrenResult.diagnostic],
        };
    },

    // TODO: spacing
    [NodeType.NonBreakingSpace]: internalTODO,
    [NodeType.ThinNonBreakingSpace]: internalTODO,

    // TODO: Table pack
    [NodeType.TableCell]: internalTODO,
    // TODO: Table pack
    [NodeType.TableRow]: internalTODO,

    // TODO: Control sequences
    [NodeType.TableControlRow]: internalTODO,
    // TODO: Control sequences
    [NodeType.TableControlCell]: internalTODO,

    [NodeType.OpCode]: internalUnparsableNodeType,
    [NodeType.Latex]: internalTODOParagraph,
    [NodeType.LatexSpan]: internalTODO,
    [NodeType.Formula]: internalUnparsableNodeType,
    [NodeType.FormulaSpan]: async (printer, node) => {
        return {
            result: [await formulaNodeToPicture(node)],
            diagnostic: [],
        };
    },
    [NodeType.Comment]: internalUnparsableNodeType,

    [ProcessedNodeType.PictureKey]: async (printer, node) => printKeyNode(node),
    [ProcessedNodeType.TableKey]: async (printer, node) => printKeyNode(node),
    [ProcessedNodeType.ApplicationKey]: async (printer, node) =>
        printKeyNode(node),
    [ProcessedNodeType.ReferenceKey]: async (printer, node) =>
        printKeyNode(node),
    [ProcessedNodeType.FormulaKey]: async (printer, node) => printKeyNode(node),

    [ProcessedNodeType.FormulaProcessed]: async (printer, node) => {
        return {
            result: [await printFormulaProcessedNode(node)],
            diagnostic: [],
        };
    },
    [ProcessedNodeType.FormulaNoLabelProcessed]: async (printer, node) => {
        return {
            result: [
                new docx.Paragraph({
                    children: [await formulaNodeToPicture(node.text)],
                    alignment: AlignmentType.CENTER,
                }),
            ],
            diagnostic: [],
        };
    },

    [ProcessedNodeType.AllApplications]: internalTODOParagraph,
    [ProcessedNodeType.AllReferences]: internalTODOParagraph,

    [ProcessedNodeType.RawApplication]: internalTODO,

    [ProcessedNodeType.PictureApplication]: internalTODO,

    [ProcessedNodeType.CodeApplication]: internalTODO,

    [ProcessedNodeType.Reference]: internalTODO,

    [ProcessedNodeType.PictureAmount]: async (printer, node) =>
        printLazyNumberNode(node.numberLazy),
    [ProcessedNodeType.TableAmount]: async (printer, node) =>
        printLazyNumberNode(node.numberLazy),
};
