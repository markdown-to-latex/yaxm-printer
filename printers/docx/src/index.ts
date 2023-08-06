import {
    DocxPrinterVisitor,
    DocxPrinterVisitorList,
    ProcessingVisitors,
    processingVisitors,
} from './visitors';
import { buildConfig, DocxPrinterConfiguration } from './printerConfig';
import { NodeProcessed } from '@md-to-latex/converter/dist/macro/node';
import { DiagnoseList } from '@md-to-latex/converter/dist/diagnostic';
import { ListNode, Node, RawNode } from '@md-to-latex/converter/dist/ast/node';
import * as docx from 'docx';
import { XmlComponent } from 'docx';
import { validateDocxRootNode } from './validation';
import {
    getDocumentGlobalStyles,
    getNumberingHeading,
    getOrderedNumberingLevels,
    getUnorderedNumberingLevels,
    INumberingOptionsConfig,
} from './styles';

const processNode: DocxPrinterVisitor<NodeProcessed | RawNode | Node> =
    function (printer, node) {
        return processingVisitors[node.type](
            printer,
            /* TODO: resolve that */ node as any,
        );
    };

const processNodeList: DocxPrinterVisitorList<NodeProcessed | RawNode | Node> =
    async function (printer, nodes) {
        const processedNodes = await Promise.all(
            nodes.map(async node => await printer.processNode(printer, node)),
        );

        const diagnostic: DiagnoseList = processedNodes.flatMap(
            nodes => nodes.diagnostic,
        );
        const result = processedNodes.flatMap(nodes => nodes.result);

        return {
            result,
            diagnostic,
        };
    };

export interface WordRefData {
    node: ListNode;
    ref: string;
    isOrdered: boolean;
}

export interface DocxPrinter {
    processNode: DocxPrinterVisitor<NodeProcessed | RawNode | Node>;
    processNodeList: DocxPrinterVisitorList<NodeProcessed | RawNode | Node>;

    processingVisitors: ProcessingVisitors;
    config: DocxPrinterConfiguration;

    wordListRefStore: WordRefData[];
}

export interface PrinterVisitorResult {
    result: docx.XmlComponent[];
    diagnostic: DiagnoseList;
}

export function createPrinterDocx(
    config: DocxPrinterConfiguration,
): DocxPrinter {
    return {
        processingVisitors,
        config: config,

        processNode,
        processNodeList,

        wordListRefStore: [],
    };
}

export async function printerResultToBuffer(
    printer: DocxPrinter,
    result: Readonly<XmlComponent[]>,
): Promise<Buffer> {
    console.log(result);

    const doc = new docx.Document({
        styles: getDocumentGlobalStyles(),
        numbering: {
            config: [
                ...printer.wordListRefStore.map<INumberingOptionsConfig>(n =>
                    n.isOrdered
                        ? {
                              reference: n.ref,
                              levels: getOrderedNumberingLevels(),
                          }
                        : {
                              reference: n.ref,
                              levels: getUnorderedNumberingLevels(),
                          },
                ),
                getNumberingHeading(),
            ],
        },
        features: {
            updateFields: true,
        },
        sections: [
            {
                properties: {
                    page: {
                        size: {
                            orientation: docx.PageOrientation.PORTRAIT,
                            height: docx.convertMillimetersToTwip(297),
                            width: docx.convertMillimetersToTwip(210),
                        },
                        margin: {
                            top: docx.convertMillimetersToTwip(20),
                            right: docx.convertMillimetersToTwip(10),
                            bottom: docx.convertMillimetersToTwip(20),
                            left: docx.convertMillimetersToTwip(30),
                        },
                    },
                },
                footers: {
                    default: new docx.Footer({
                        children: [
                            new docx.Paragraph({
                                indent: {
                                    firstLine: 0,
                                },
                                alignment: docx.AlignmentType.CENTER,
                                children: [
                                    new docx.TextRun({
                                        children: [docx.PageNumber.CURRENT],
                                    }),
                                ],
                            }),
                        ],
                    }),
                },
                children: [
                    ...result.map(n => {
                        if (
                            !(
                                n instanceof docx.Paragraph ||
                                n instanceof docx.Table
                            )
                        ) {
                            return new docx.Paragraph({
                                children: [n],
                            });
                        }
                        return n;
                    }),
                ],
            },
        ],
    });
    return await docx.Packer.toBuffer(doc);
}

export { buildConfig, validateDocxRootNode };
