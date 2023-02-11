import * as docx from "docx";
import { XmlComponent } from "docx";
import {
    DiagnoseErrorType,
    DiagnoseInfo,
    DiagnoseList,
    DiagnoseSeverity
} from "@md-to-latex/converter/dist/diagnostic";

function docxRootDiagnose(severity: DiagnoseSeverity, message: string): DiagnoseInfo {
    return {
        pos: { start: { line: 0, column: 0, absolute: 0 }, end: { line: 0, column: 0, absolute: 0 } },
        errorType: DiagnoseErrorType.OtherError,
        filePath: ".",
        message,
        severity
    };
}

function getXmlComponentRoot(docxNode: Readonly<XmlComponent>): any[] {
    interface XmlComponentWithRoot {
        root?: any[];
    }

    let casted = docxNode as unknown as XmlComponentWithRoot;

    if (!casted.root) {
        return [];
    }
    return casted.root;
}

export function validateDocxRootNode(docxNode: Readonly<XmlComponent>): DiagnoseList {
    let diagnostic: DiagnoseList = [];

    if (!(docxNode instanceof docx.Paragraph)) {
        // TODO: provide more details: which node, etc..
        diagnostic.push(docxRootDiagnose(DiagnoseSeverity.Error, "The docx root node is not a paragraph"));
    }

    let queue: Readonly<XmlComponent>[] = [docxNode];
    while (queue.length !== 0) {
        let component = queue.pop()!;

        // TODO: idk why the root is children wth
        let children = getXmlComponentRoot(component);
        for (let child of children) {
            if (child instanceof docx.Paragraph) {
                diagnostic.push(
                    docxRootDiagnose(
                        DiagnoseSeverity.Error,
                        "Docx Paragraph in paragraph detected"
                    )
                );
            }
        }

        queue.push(...children);
    }


    return diagnostic;
}