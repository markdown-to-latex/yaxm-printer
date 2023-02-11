import { FormulaNode, NodeAbstract, NodeType } from "@md-to-latex/converter/dist/ast/node";
import {
    LatexInterpretation,
    DocxPrinterConfiguration
} from "./printerConfig";
import {
    DiagnoseErrorType,
    DiagnoseList,
    DiagnoseSeverity,
    nodeToDiagnose
} from "@md-to-latex/converter/dist/diagnostic";
import * as docx from "docx";
import * as texsvg from "tex-to-svg";


// @ts-ignore
import * as svg2png from "svg2png";
import { YAMLException } from "js-yaml";

export interface PrinterFunctionResult {
    result: string;
    diagnostic: DiagnoseList;
}

const RE_SVG_SIZE_W = /<svg [^>]+ width="([0-9.]+)ex" [^>]+>/g;
const RE_SVG_SIZE_H = /<svg [^>]+ height="([0-9.]+)ex" [^>]+>/g;

export function getSvgSizeEx(svgRaw: string): [number, number] {
    const matchW: RegExpMatchArray | undefined = svgRaw.matchAll(RE_SVG_SIZE_W).next().value;
    if (!matchW) {
        throw new YAMLException("Unable to get width");
    }
    const matchH: RegExpMatchArray | undefined = svgRaw.matchAll(RE_SVG_SIZE_H).next().value;
    if (!matchH) {
        throw new YAMLException("Unable to get height");
    }

    return [+matchW[1], +matchH[1]];
}

export function formulaNodeToPicture(node: FormulaNode): docx.ImageRun {
    let svgRaw = texsvg.default(node.text.text);
    console.log(svgRaw);

    const [w, h] = getSvgSizeEx(svgRaw);
    const k = 10;

    let outputBuffer: Buffer = svg2png.sync(svgRaw, { width: w * k, height: h * k });

    // TODO: capture error
    // TODO: node to svg
    // TODO: svg to png x4
    // TODO: png calculate size using 96 dpi inch size

    console.log(`W: ${w} H: ${h}`)

    return new docx.ImageRun({
        data: outputBuffer,
        transformation: {
            width: w * k,
            height: h * k
        }
    });
}