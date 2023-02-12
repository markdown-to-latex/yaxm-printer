import {
    ListItemNode,
    ListNode,
    NodeText,
} from '@md-to-latex/converter/dist/ast/node';
import { DiagnoseList } from '@md-to-latex/converter/dist/diagnostic';
import * as docx from 'docx';
import {
    AlignmentType,
    Paragraph,
    TextRun,
    VerticalAlign,
    WidthType,
} from 'docx';
import { default as texsvg } from 'texsvg';
import { YAMLException } from 'js-yaml';

// @ts-ignore
import * as svg2png from 'convert-svg-to-png';
import { FormulaProcessedNode } from '@md-to-latex/converter/dist/macro/node';
import { DocxPrinter } from './index';

export interface PrinterFunctionResult {
    result: docx.XmlComponent[];
    diagnostic: DiagnoseList;
}

function getOrCreateWordListRef(
    printer: DocxPrinter,
    node: ListNode,
    isOrdered: boolean,
): string {
    // wow https://stackoverflow.com/a/12502559/14142236
    const randomRef = () => Math.random().toString(36).slice(2);

    const ref = printer.wordListRefStore.find(
        entry => entry.node === node,
    )?.ref;
    if (ref) {
        return ref;
    }

    const newRef = randomRef();
    printer.wordListRefStore.push({ node, ref: newRef, isOrdered });
    return newRef;
}

export interface GetWordListItemData {
    xml: docx.XmlComponent[];
    depth: number;
    index: number;
    isOrdered: boolean;
}

export async function getWordListItem(
    printer: DocxPrinter,
    data: GetWordListItemData,
    node: ListItemNode,
    superparentList: ListNode,
): Promise<PrinterFunctionResult> {
    const ref = getOrCreateWordListRef(
        printer,
        superparentList,
        data.isOrdered,
    );
    return {
        result: [
            new Paragraph({
                children: data.xml,
                numbering: {
                    instance: 0,
                    reference: ref,
                    level: data.depth - 1,
                },
            }),
        ],
        diagnostic: [],
    };
}

const RE_SVG_SIZE_W = /<svg [^>]+ width="([0-9.]+)ex" [^>]+>/g;
const RE_SVG_SIZE_H = /<svg [^>]+ height="([0-9.]+)ex" [^>]+>/g;

export function getSvgSizeEx(svgRaw: string): [number, number] {
    const matchW: RegExpMatchArray | undefined = svgRaw
        .matchAll(RE_SVG_SIZE_W)
        .next().value;
    if (!matchW) {
        // TODO: diagnostic
        throw new YAMLException('Unable to get width');
    }
    const matchH: RegExpMatchArray | undefined = svgRaw
        .matchAll(RE_SVG_SIZE_H)
        .next().value;
    if (!matchH) {
        // TODO: diagnostic
        throw new YAMLException('Unable to get height');
    }

    return [+matchW[1], +matchH[1]];
}

const RE_SVG_ERROR = /data-mjx-error="([^"]+)"/g;

export async function printKeyNode(node: { index: number }) {
    return {
        result: [
            new docx.TextRun({
                text: `${node.index + 1}`,
            }),
        ],
        diagnostic: [],
    };
}

export async function printLazyNumberNode(fun: () => number) {
    return {
        result: [
            new docx.TextRun({
                text: `${fun()}`,
            }),
        ],
        diagnostic: [],
    };
}

// TODO: with diagnostic
export async function printFormulaProcessedNode(
    node: FormulaProcessedNode,
): Promise<docx.XmlComponent> {
    return new docx.Table({
        borders: {
            right: { style: docx.BorderStyle.NONE },
            left: { style: docx.BorderStyle.NONE },
            top: { style: docx.BorderStyle.NONE },
            bottom: { style: docx.BorderStyle.NONE },
            insideVertical: { style: docx.BorderStyle.NONE },
            insideHorizontal: { style: docx.BorderStyle.NONE },
        },
        rows: [
            new docx.TableRow({
                children: [
                    new docx.TableCell({
                        children: [
                            new docx.Paragraph({
                                children: [
                                    await formulaNodeToPicture(node.text),
                                ],
                                alignment: AlignmentType.CENTER,
                            }),
                        ],
                        verticalAlign: VerticalAlign.CENTER,
                    }),
                    new docx.TableCell({
                        children: [
                            new docx.Paragraph({
                                text: `(${node.index + 1})`,
                                alignment: AlignmentType.RIGHT,
                            }),
                        ],
                        verticalAlign: VerticalAlign.CENTER,
                        width: {
                            type: WidthType.DXA,
                            size: 510, // is 0.35 inches == 0.9 cm
                        },
                    }),
                ],
            }),
        ],
        width: {
            type: WidthType.PERCENTAGE,
            size: 100,
        },
    });
}

// TODO: with diagnostic
export async function formulaNodeToPicture(
    node: NodeText,
): Promise<docx.ImageRun> {
    let text = `\\begin{align*}${node.text}\\end{align*}`;

    let svgRaw;
    try {
        svgRaw = await texsvg(text);
    } catch (e: any) {
        console.error(`Error: ${e}`);
        const captured = (() => {
            const value = (e.source ?? '').matchAll(RE_SVG_ERROR).next().value;
            if (!value) {
                return undefined;
            }
            return value[1] as string;
        })();
        const message = captured ? captured : 'Unknown';

        // TODO: diagnostic
        throw new YAMLException(`Unable to convert tex to svg: ${message}`);
    }

    const [w, h] = getSvgSizeEx(svgRaw);
    const k = 8;

    let outputBuffer: Buffer = await svg2png.convert(svgRaw, {
        scale: 100,
    });

    console.log(`W: ${w} H: ${h}`);

    return new docx.ImageRun({
        data: outputBuffer,
        transformation: {
            width: Math.ceil(w * k),
            height: Math.ceil(h * k),
        },
    });
}

export interface WordTableInfo {
    tableIndex: string;
    tableTitle: docx.XmlComponent[];
    header: docx.TableRow;
    content: docx.TableRow[];
    colAmount: number;
}

export function getWordTable(info: WordTableInfo): PrinterFunctionResult {
    return {
        result: [
            new docx.Paragraph({
                children: [
                    new docx.TextRun({
                        text: `Таблица ${info.tableIndex} – `,
                    }),
                    ...info.tableTitle,
                ],
            }),
            new docx.Table({
                width: {
                    type: WidthType.PERCENTAGE,
                    size: 100,
                },
                rows: [info.header, ...info.content],
            }),
        ],
        diagnostic: [],
    };
}

// ---------

export interface IRunOptionsExt extends docx.IRunOptions {
    /**
     * In pt/2
     */
    position?: number;
    spacing?: number;
}

export function createTextRunExt(options: IRunOptionsExt | string) {
    // export class TextRunExt extends docx.TextRun
    // doesn't work due to runtime constructor error

    const textRun = new docx.TextRun(options);
    const properties = (textRun as any).properties as docx.RunProperties;
    if (typeof options !== 'string') {
        if (options.position) {
            properties.push(
                new docx.NumberValueElement('w:position', options.position),
            );
        }
        if (options.spacing) {
            properties.push(
                new docx.NumberValueElement('w:spacing', options.spacing),
            );
        }
    }

    return textRun;
}
