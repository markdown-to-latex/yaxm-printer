import {FormulaNode} from '@md-to-latex/converter/dist/ast/node';
import {DiagnoseList} from '@md-to-latex/converter/dist/diagnostic';
import * as docx from 'docx';
import {AlignmentType, VerticalAlign, WidthType} from 'docx';
import {default as texsvg} from 'texsvg';
import {YAMLException} from 'js-yaml';

// @ts-ignore
import * as svg2png from 'convert-svg-to-png';

export interface PrinterFunctionResult {
    result: string;
    diagnostic: DiagnoseList;
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
        result: [new docx.TextRun({
            text: `${node.index}`
        })],
        diagnostic: []
    }
}
export async function printLazyNumberNode(fun: () => number) {
    return {
        result: [new docx.TextRun({
            text: `${fun()}`
        })],
        diagnostic: []
    }
}

export async function formulaNodeToPicture(
    node: FormulaNode,
): Promise<docx.XmlComponent> {
    let text = `\\begin{align*}${node.text.text}\\end{align*}`;

    let svgRaw;
    try {
        svgRaw = await texsvg(text);
    } catch (e: any) {
        console.error(`Error: ${e}`);
        const captured = (() => {
            const value = (e.source || '').matchAll(RE_SVG_ERROR).next().value;
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

    const image = new docx.ImageRun({
        data: outputBuffer,
        transformation: {
            width: Math.ceil(w * k),
            height: Math.ceil(h * k),
        },
    });
    return new docx.Table({
        borders: {
            right: {style: docx.BorderStyle.NONE},
            left: {style: docx.BorderStyle.NONE},
            top: {style: docx.BorderStyle.NONE},
            bottom: {style: docx.BorderStyle.NONE},
            insideVertical: {style: docx.BorderStyle.NONE},
            insideHorizontal: {style: docx.BorderStyle.NONE},
        },
        rows: [
            new docx.TableRow({
                children: [
                    new docx.TableCell({
                        children: [
                            new docx.Paragraph({
                                children: [image],
                                alignment: AlignmentType.CENTER,
                            }),
                        ],
                        verticalAlign: VerticalAlign.CENTER,
                    }),
                    new docx.TableCell({
                        children: [
                            new docx.Paragraph({
                                text: '(1)',
                                alignment: AlignmentType.RIGHT,
                            }),
                        ],
                        verticalAlign: VerticalAlign.CENTER,
                        width: {
                            type: WidthType.DXA,
                            size: 510 // is 0.35 inches == 0.9 cm
                        }
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
