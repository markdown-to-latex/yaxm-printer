import {
    getNodeRightNeighbourLeaf,
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
import { AlignmentType, Paragraph, TextRun } from 'docx';
import {
    formulaNodeToPicture,
    printKeyNode,
    printLazyNumberNode,
} from './printer';
import * as fs from 'fs';
import path from 'path';
import sizeOf from 'image-size';

function isNodeBeforeBoxed(node: NodeAbstract): boolean {
    let right = getNodeRightNeighbourLeaf(node);

    while (
        right !== null &&
        [NodeType.Space, NodeType.OpCode].indexOf(right.type as NodeType) !== -1
    ) {
        right = getNodeRightNeighbourLeaf(right);
    }
    if (right === null) {
        return false;
    }

    return (
        [
            NodeType.Code,
            NodeType.Table,
            NodeType.Image,
            ProcessedNodeType.CodeProcessed,
            ProcessedNodeType.TableProcessed,
            ProcessedNodeType.PictureProcessed,
        ].indexOf(right.type as NodeType) !== -1
    );
}

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
    result: [new docx.TextRun({ text: `[TODO (inline) '${node.type}']` })],
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
    result: [new docx.Paragraph({ text: `[TODO (paragraph) '${node.type}']` })],
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

    [NodeType.Space]: internalTODO,
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
    [ProcessedNodeType.TableProcessed]: internalTODOParagraph,
    [NodeType.Blockquote]: unparsableNodeType,
    [NodeType.List]: internalTODO,
    [NodeType.ListItem]: internalTODO,
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
    [NodeType.Def]: unparsableNodeType,
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
    [NodeType.Html]: unparsableNodeType,
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
    [NodeType.Strong]: internalTODO,
    [NodeType.Underline]: internalTODO,
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
    [NodeType.Br]: internalTODO,
    [NodeType.Del]: internalTODO,
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

    [NodeType.NonBreakingSpace]: internalTODO,
    [NodeType.ThinNonBreakingSpace]: internalTODO,

    [NodeType.TableCell]: internalTODO,
    [NodeType.TableRow]: internalTODO,

    // TODO: Control sequences
    [NodeType.TableControlRow]: internalTODO,
    // TODO: Control sequences
    [NodeType.TableControlCell]: internalTODO,

    [NodeType.OpCode]: internalUnparsableNodeType,
    [NodeType.Latex]: internalTODOParagraph,
    [NodeType.LatexSpan]: internalTODO,
    [NodeType.Formula]: async (printer, node) => {
        return {
            result: [await formulaNodeToPicture(node)],
            diagnostic: [],
        };
    },
    [NodeType.FormulaSpan]: internalTODO,
    [NodeType.Comment]: internalUnparsableNodeType,

    // [ProcessedNodeType.PictureKey]: internalTODO,
    // [ProcessedNodeType.TableKey]: internalTODO,
    // [ProcessedNodeType.ApplicationKey]: internalTODO,
    // [ProcessedNodeType.ReferenceKey]: internalTODO,
    [ProcessedNodeType.PictureKey]: async (printer, node) => printKeyNode(node),
    [ProcessedNodeType.TableKey]: async (printer, node) => printKeyNode(node),
    [ProcessedNodeType.ApplicationKey]: async (printer, node) =>
        printKeyNode(node),
    [ProcessedNodeType.ReferenceKey]: async (printer, node) =>
        printKeyNode(node),

    // TODO WARNING: perhaps it is inside the paragraph
    [ProcessedNodeType.AllApplications]: internalTODO /* WARNING Par*/,
    [ProcessedNodeType.AllReferences]: internalTODO /* WARNING Par*/,

    [ProcessedNodeType.RawApplication]: internalTODO,

    [ProcessedNodeType.PictureApplication]: internalTODO,

    [ProcessedNodeType.CodeApplication]: internalTODO,

    [ProcessedNodeType.Reference]: internalTODO,

    // [ProcessedNodeType.PictureAmount]: internalTODO,
    // [ProcessedNodeType.TableAmount]: internalTODO,
    [ProcessedNodeType.PictureAmount]: async (printer, node) =>
        printLazyNumberNode(node.numberLazy),
    [ProcessedNodeType.TableAmount]: async (printer, node) =>
        printLazyNumberNode(node.numberLazy),
};
