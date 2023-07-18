import * as docx from "docx";
import { validateDocxRootNode } from "../../src/validation";

describe("validation test", function() {
    test("paragraph must be the root node", function() {
        let diagnostic = validateDocxRootNode(new docx.TextRun({}));
        expect(diagnostic).toMatchSnapshot();
    });

    test("paragraph must not contain paragraphs", function() {
        let node = new docx.Paragraph({
            children: [
                new docx.TextRun({
                    children: [new docx.Paragraph({})]
                })
            ]
        });
        let diagnostic = validateDocxRootNode(node);
        expect(diagnostic).toMatchSnapshot();
    });
});