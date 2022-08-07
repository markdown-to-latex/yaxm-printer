import {
    LatexPrinterVisitor,
    LatexPrinterVisitorList,
    ProcessingVisitors,
    processingVisitors,
} from './visitors';
import { buildConfig, LatexPrinterConfiguration } from './printerConfig';
import { NodeProcessed } from '@md-to-latex/converter/dist/macro/node';
import { DiagnoseList } from '@md-to-latex/converter/dist/diagnostic';
import { Node, RawNode } from '@md-to-latex/converter/dist/ast/node';

const processNode: LatexPrinterVisitor<NodeProcessed | RawNode | Node> =
    function (printer, node) {
        return processingVisitors[node.type](
            printer,
            /* TODO: resolve that */ node as any,
        );
    };

const processNodeList: LatexPrinterVisitorList<NodeProcessed | RawNode | Node> =
    function (printer, nodes, separator = '') {
        const processedNodes = nodes.map(node =>
            printer.processNode(printer, node),
        );

        const diagnostic: DiagnoseList = processedNodes.flatMap(
            nodes => nodes.diagnostic,
        );
        const result: string = processedNodes
            .map(nodes => nodes.result)
            .join(separator);

        return {
            result,
            diagnostic,
        };
    };

export interface LatexPrinter {
    processNode: LatexPrinterVisitor<NodeProcessed | RawNode | Node>;
    processNodeList: LatexPrinterVisitorList<NodeProcessed | RawNode | Node>;

    processingVisitors: ProcessingVisitors;
    config: LatexPrinterConfiguration;
}

export interface PrinterVisitorResult {
    result: string;
    diagnostic: DiagnoseList;
}

export function createPrinterLatex(
    config: LatexPrinterConfiguration,
): LatexPrinter {
    return {
        processingVisitors,
        config: config,

        processNode,
        processNodeList,
    };
}

export { buildConfig };
