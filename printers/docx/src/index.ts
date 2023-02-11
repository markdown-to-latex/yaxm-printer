import {
    DocxPrinterVisitor,
    DocxPrinterVisitorList,
    ProcessingVisitors,
    processingVisitors
} from "./visitors";
import {buildConfig, DocxPrinterConfiguration} from "./printerConfig";
import {NodeProcessed} from "@md-to-latex/converter/dist/macro/node";
import {DiagnoseList} from "@md-to-latex/converter/dist/diagnostic";
import {Node, RawNode} from "@md-to-latex/converter/dist/ast/node";
import * as docx from "docx";
import {XmlComponent} from "docx";
import {validateDocxRootNode} from "./validation";

const processNode: DocxPrinterVisitor<NodeProcessed | RawNode | Node> =
    function (printer, node) {
        return processingVisitors[node.type](
            printer,
            /* TODO: resolve that */ node as any
        );
    };

const processNodeList: DocxPrinterVisitorList<NodeProcessed | RawNode | Node> =
    async function (printer, nodes) {
        const processedNodes = await Promise.all(nodes.map(async node =>
            await printer.processNode(printer, node)
        ));

        const diagnostic: DiagnoseList = processedNodes.flatMap(
            nodes => nodes.diagnostic
        );
        const result = processedNodes
            .flatMap(nodes => nodes.result);

        return {
            result,
            diagnostic
        };
    };

export interface DocxPrinter {
    processNode: DocxPrinterVisitor<NodeProcessed | RawNode | Node>;
    processNodeList: DocxPrinterVisitorList<NodeProcessed | RawNode | Node>;

    processingVisitors: ProcessingVisitors;
    config: DocxPrinterConfiguration;
}

export interface PrinterVisitorResult {
    result: docx.XmlComponent[];
    diagnostic: DiagnoseList;
}

export function createPrinterDocx(
    config: DocxPrinterConfiguration
): DocxPrinter {
    return {
        processingVisitors,
        config: config,

        processNode,
        processNodeList
    };
}

export async function printerResultToBuffer(result: Readonly<XmlComponent[]>): Promise<Buffer> {
    console.log(result);

    const doc = new docx.Document({
        features: {
            updateFields: true
        },
        sections: [{
            children: [...result.map(n => {
                if (!(n instanceof docx.Paragraph || n instanceof docx.Table)) {
                    return new docx.Paragraph({
                        children: [n]
                    })
                }
                return n
            })]
        }]
    });
    return await docx.Packer.toBuffer(doc);
}


export {buildConfig, validateDocxRootNode};
