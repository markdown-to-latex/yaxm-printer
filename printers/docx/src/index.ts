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
        numbering: {
            config: printer.wordListRefStore.map<
                docx.INumberingOptions['config'][0]
            >(n => ({
                // TODO: fully prepare the list styles for ordered and unordered list
                reference: n.ref,
                levels: [
                    {
                        level: 0,
                        format: docx.LevelFormat.UPPER_ROMAN,
                        text: '0.%1',
                        alignment: docx.AlignmentType.START,
                        style: {
                            paragraph: {
                                leftTabStop: docx.convertMillimetersToTwip(40),
                                indent: {
                                    firstLine:
                                        docx.convertMillimetersToTwip(20),
                                },
                            },
                        },
                    },
                    {
                        level: 1,
                        format: docx.LevelFormat.UPPER_ROMAN,
                        text: '1.%1',
                        alignment: docx.AlignmentType.START,
                        style: {
                            paragraph: {
                                leftTabStop: docx.convertMillimetersToTwip(60),
                                indent: {
                                    firstLine:
                                        docx.convertMillimetersToTwip(40),
                                },
                            },
                        },
                    },
                    {
                        level: 2,
                        format: docx.LevelFormat.UPPER_ROMAN,
                        text: '%2.%1',
                        alignment: docx.AlignmentType.START,
                        style: {
                            paragraph: {
                                leftTabStop: docx.convertMillimetersToTwip(80),
                                indent: {
                                    firstLine:
                                        docx.convertMillimetersToTwip(60),
                                },
                            },
                        },
                    },
                ],
            })),
        },
        features: {
            updateFields: true,
        },
        sections: [
            {
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
