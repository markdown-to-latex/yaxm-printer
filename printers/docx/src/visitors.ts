import {
    findNodeData,
    getNodeRightNeighbourLeaf,
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
import * as docx from 'docx'
import { formulaNodeToPicture } from "./printer";

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
) => PrinterVisitorResult;

export type DocxPrinterVisitorList<T = NodeAbstract> = (
    printer: DocxPrinter,
    node: T[],
    separator?: string,
) => PrinterVisitorResult;

export type ProcessingVisitors = {
    [Key in keyof AllNodesByType]: DocxPrinterVisitor<AllNodesByType[Key]>;
};

const unparsableNodeType: DocxPrinterVisitor = (printer, node) => ({
    result: [new docx.TextRun({text: "Unparsable"})],
    diagnostic: [
        nodeToDiagnose(
            node,
            DiagnoseSeverity.Warning,
            DiagnoseErrorType.PrinterError,
            `Unable to print node with type '${node.type}'`,
        ),
    ],
});

const internalUnparsableNodeType: DocxPrinterVisitor = (printer, node) => ({
    result: [new docx.TextRun({text: "InternalError"})],
    diagnostic: [
        nodeToDiagnose(
            node,
            DiagnoseSeverity.Warning,
            DiagnoseErrorType.PrinterError,
            `Unable to print node with type '${node.type}' (internal error)`,
        ),
    ],
});

const internalTODO: DocxPrinterVisitor = (printer, node) => ({
    // result: [],
    result: [new docx.TextRun({text: `[TODO (inline) '${node.type}']`})],
    diagnostic: [
        nodeToDiagnose(
            node,
            DiagnoseSeverity.Warning,
            DiagnoseErrorType.PrinterError,
            `Unable to print node with type '${node.type}' (TODO)`,
        ),
    ],
});
const internalTODOParagraph: DocxPrinterVisitor = (printer, node) => ({
    result: [new docx.Paragraph({text: `[TODO '${node.type}']`})],
    diagnostic: [
        nodeToDiagnose(
            node,
            DiagnoseSeverity.Warning,
            DiagnoseErrorType.PrinterError,
            `Unable to print node with type '${node.type}' (TODO)`,
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
    [NodeType.Heading]: internalTODOParagraph,
    [NodeType.Table]: internalUnparsableNodeType,
    [ProcessedNodeType.TableProcessed]: internalTODOParagraph,
    [NodeType.Blockquote]: unparsableNodeType,
    [NodeType.List]: internalTODO,
    [NodeType.ListItem]: internalTODO,
    [NodeType.Paragraph]: internalTODOParagraph,
    [NodeType.Def]: unparsableNodeType,
    [NodeType.Escape]: internalTODO,
    [NodeType.Text]: internalTODO,
    [NodeType.Html]: unparsableNodeType,
    [NodeType.Link]: internalTODO,
    [NodeType.Image]: internalUnparsableNodeType,
    [ProcessedNodeType.PictureProcessed]: internalTODOParagraph,
    [NodeType.Strong]: internalTODO,
    [NodeType.Underline]: internalTODO,
    [NodeType.Em]: internalTODO,
    [NodeType.Hr]: internalTODOParagraph,
    [NodeType.CodeSpan]: internalTODO,
    [NodeType.Br]: internalTODO,
    [NodeType.Del]: internalTODO,
    [NodeType.File]: (printer, node) => {
        // TODO: if it is not a paragraph -> wrap over a paragraph
        // TODO: validate paragraphs in paragraphs
        const childrenResult = printer.processNodeList(printer, node.children);
        return {
            result: [...childrenResult.result],
            diagnostic: [...childrenResult.diagnostic]
        }
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
    [NodeType.Formula]: (printer, node) => {
        return {
            result: [formulaNodeToPicture(node)],
            diagnostic: [],
        }
    },
    [NodeType.FormulaSpan]: internalTODO,
    [NodeType.Comment]: internalUnparsableNodeType,

    [ProcessedNodeType.PictureKey]: internalTODO,
    [ProcessedNodeType.TableKey]: internalTODO,
    [ProcessedNodeType.ApplicationKey]: internalTODO,
    [ProcessedNodeType.ReferenceKey]: internalTODO,

    [ProcessedNodeType.AllApplications]: internalTODO,
    [ProcessedNodeType.AllReferences]: internalTODO,

    [ProcessedNodeType.RawApplication]: internalTODO,

    [ProcessedNodeType.PictureApplication]: internalTODO,

    [ProcessedNodeType.CodeApplication]: internalTODO,

    [ProcessedNodeType.Reference]: internalTODO,

    [ProcessedNodeType.PictureAmount]: internalTODO,
    [ProcessedNodeType.TableAmount]: internalTODO,
};
