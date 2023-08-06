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
import {
    BorderStyle,
    Paragraph,
    TextRun,
    UnderlineType,
    VerticalAlign,
} from 'docx';
import {
    createTextRunExt,
    createWordPicture,
    createWordPictureLabel,
    formulaNodeToPicture,
    getWordListItem,
    getWordTable,
    prepareRawText,
    printFormulaProcessedNode,
    printKeyNode,
    printLazyNumberNode,
} from './printer';
import {RenderMathInterpretation} from "./printerConfig";

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
    [ProcessedNodeType.CodeProcessed]: async (printer, node) => {
        const resultName = await printer.processNodeList(printer, node.name);

        const resultCaption = createWordPictureLabel(
            node.index + 1,
            resultName.result,
        );

        return {
            result: [
                new Paragraph({
                    style: 'code',
                    children: node.code.text.split('\n').map(
                        (line, i) =>
                            new docx.TextRun({
                                text: line,
                                break: i != 0 ? 1 : 0, // break before
                            }),
                    ),
                    border: {
                        top: {
                            style: BorderStyle.SINGLE,
                        },
                        right: {
                            style: BorderStyle.SINGLE,
                        },
                        bottom: {
                            style: BorderStyle.SINGLE,
                        },
                        left: {
                            style: BorderStyle.SINGLE,
                        },
                    },
                    keepNext: true,
                }),
                ...resultCaption.result,
            ],
            diagnostic: [...resultName.diagnostic, ...resultCaption.diagnostic],
        };
    },
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
    [ProcessedNodeType.TableProcessed]: async (printer, node) => {
        const diagnostic: DiagnoseList = [];
        const nameResult = await printer.processNodeList(printer, node.name);
        diagnostic.push(...nameResult.diagnostic);
        const headerResult = await printer.processNodeList(
            printer,
            node.header,
        );
        diagnostic.push(...headerResult.diagnostic);
        const contentResult = await printer.processNodeList(printer, node.rows);
        diagnostic.push(...contentResult.diagnostic);

        const tableResult = getWordTable({
            tableIndex: (node.index + 1).toString(),
            tableTitle: nameResult.result,
            header: (headerResult.result as [docx.TableRow])[0], // TODO: runtime check
            content: contentResult.result as docx.TableRow[], // TODO: runtime check
            colAmount: node.header[0].children.length,
        });
        diagnostic.push(...tableResult.diagnostic);
        return {
            result: tableResult.result,
            diagnostic,
        };
    },

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
        const text = prepareRawText(node.text);
        return {
            result: [
                new docx.TextRun({
                    text: text,
                }),
            ],
            diagnostic: [],
        };
    },
    [NodeType.Link]: internalTODO,
    [NodeType.Image]: internalUnparsableNodeType,
    [ProcessedNodeType.PictureProcessed]: async (printer, node) => {
        const resultName = await printer.processNodeList(printer, node.name);

        const resultPicture = await createWordPicture(node);
        const resultCaption = createWordPictureLabel(
            node.index + 1,
            resultName.result,
        );

        return {
            result: [
                new Paragraph({
                    children: [...resultPicture.result],
                    keepNext: true,
                    style: 'picture',
                }),
                ...resultCaption.result,
            ],
            diagnostic: [
                ...resultName.diagnostic,
                ...resultPicture.diagnostic,
                ...resultCaption.diagnostic,
            ],
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
        const text = prepareRawText(node.text);
        return {
            result: [
                new docx.TextRun({
                    text: `«${text}»`,
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

    [NodeType.NonBreakingSpace]: async (_printer, node) => ({
        result: [new docx.TextRun(' ')],
        diagnostic: [
            nodeToDiagnose(
                node,
                DiagnoseSeverity.Info,
                DiagnoseErrorType.PrinterError,
                'Docx printer NonBreakingSpace equals to the default space',
            ),
        ],
    }),

    [NodeType.ThinNonBreakingSpace]: async (_printer, _node) => ({
        result: [new docx.TextRun('\xA0')],
        diagnostic: [],
    }),

    [NodeType.TableCell]: async (printer, node) => {
        const result = await printer.processNodeList(printer, node.children);
        return {
            result: [
                new docx.TableCell({
                    children: [
                        new Paragraph({
                            children: result.result,
                            style: 'table-cell',
                        }),
                    ],
                    verticalAlign: VerticalAlign.CENTER,
                }),
            ],
            diagnostic: [...result.diagnostic],
        };
    },
    [NodeType.TableRow]: async (printer, node) => {
        const diagnostic: DiagnoseList = [];
        const childrenResult = await printer.processNodeList(
            printer,
            node.children,
        );
        const notCell = childrenResult.result.filter(
            c => !(c instanceof docx.TableCell),
        );
        if (notCell.length !== 0) {
            console.error('Not cells', notCell);
            diagnostic.push(
                nodeToDiagnose(
                    node,
                    DiagnoseSeverity.Error,
                    DiagnoseErrorType.PrinterError,
                    `Not cell in row (internal error)`,
                ),
            );
        }
        const cells = childrenResult.result as docx.TableCell[];

        return {
            result: [
                new docx.TableRow({
                    children: cells,
                }),
            ],
            diagnostic: [...diagnostic],
        };
    },

    // TODO: Control sequences
    [NodeType.TableControlRow]: async () => ({
        result: [],
        diagnostic: [],
    }),
    // TODO: Control sequences
    [NodeType.TableControlCell]: async () => ({
        result: [],
        diagnostic: [],
    }),

    [NodeType.OpCode]: internalUnparsableNodeType,
    [NodeType.Latex]: internalTODOParagraph,
    [NodeType.LatexSpan]: internalTODO,
    [NodeType.Formula]: internalUnparsableNodeType,
    [NodeType.FormulaSpan]: async (printer, node) => {
        const toResult: Record<RenderMathInterpretation, () => Promise<docx.XmlComponent[]>> = {
            "docxMath": async () => [
                new docx.Math({
                    children: [new docx.TextRun(node.text)],
                }),
            ],
            "picture": async () => [
                createTextRunExt({
                    children: [await formulaNodeToPicture(node)],
                    position: -6,
                }),
            ],
        };

        return {
            result: await toResult[printer.config.renderMathAs](),
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
                    children: [
                        new docx.Math({
                            children: [
                                new docx.TextRun(
                                    node.text.text.replace('\n', ' '),
                                ),
                            ],
                        }),
                    ],
                    style: 'formula-picture',
                }),
            ],
            diagnostic: [],
        };
    },

    [ProcessedNodeType.AllApplications]: async (printer, node) => {
        // TODO(toliak): Check that all children are paragraphs
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
    [ProcessedNodeType.AllReferences]: async (printer, node) => {
        // TODO(toliak): Check that all children are paragraphs
        const result = await printer.processNodeList(printer, node.children);

        const diagnostic: DiagnoseList = [];
        // TODO(toliak): Encapsulate
        for (const resultElement of result.result) {
            if (!(resultElement instanceof docx.Paragraph)) {
                diagnostic.push(
                    nodeToDiagnose(
                        node,
                        DiagnoseSeverity.Error,
                        DiagnoseErrorType.PrinterError,
                        'Detected not paragraph DOCX node in AllReferences',
                    ),
                );
            }
        }

        return {
            result: [...result.result],
            diagnostic: [...result.diagnostic, ...diagnostic],
        };
    },

    [ProcessedNodeType.RawApplication]: internalTODO,

    [ProcessedNodeType.PictureApplication]: internalTODO,

    [ProcessedNodeType.CodeApplication]: internalTODO,

    [ProcessedNodeType.Reference]: async (printer, node) => {
        const result = await printer.processNodeList(printer, node.children);

        return {
            result: [
                new docx.Paragraph({
                    children: [
                        new docx.TextRun(`${node.index + 1}.\xA0`),
                        ...result.result,
                    ],
                }),
            ],
            diagnostic: [...result.diagnostic],
        };
    },

    [ProcessedNodeType.PictureAmount]: async (printer, node) =>
        printLazyNumberNode(node.numberLazy),
    [ProcessedNodeType.TableAmount]: async (printer, node) =>
        printLazyNumberNode(node.numberLazy),
};
