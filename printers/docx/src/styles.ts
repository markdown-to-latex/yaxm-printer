import * as docx from 'docx';
import { AlignmentType, BorderStyle } from 'docx';

function fontSizeToDocxFontSize(size: number): number {
    return size * 2;
}

export function getDocumentGlobalStyles(): docx.IStylesOptions {
    const defaultSpacing = {
        after: 0,
        before: 0,
        // I don't know, it's 1.5 spacing
        line: 360,
    };
    const defaultIndent = {
        firstLine: '1.25cm',
    };
    const defaultFont = {
        font: 'Tinos',
        size: fontSizeToDocxFontSize(14),
    };
    const defaultPictureSpacingMm = 6;
    const defaultTableSpacingMm = defaultPictureSpacingMm * 1.5;

    return {
        default: {
            document: {
                paragraph: {
                    alignment: AlignmentType.JUSTIFIED,
                    indent: { ...defaultIndent },
                    spacing: { ...defaultSpacing },
                },
                run: { ...defaultFont },
            },
            heading1: {
                paragraph: {
                    numbering: {
                        reference: 'heading-ref',
                        level: 0,
                    },
                    alignment: AlignmentType.CENTER,
                    indent: { firstLine: 0 },
                    spacing: { ...defaultSpacing },
                },
                run: { ...defaultFont, bold: true },
            },
            heading2: {
                paragraph: {
                    numbering: {
                        reference: 'heading-ref',
                        level: 1,
                    },
                    alignment: AlignmentType.JUSTIFIED,
                    indent: { ...defaultIndent },
                    spacing: { ...defaultSpacing },
                },
                run: { ...defaultFont, bold: true },
            },
            heading3: {
                paragraph: {
                    numbering: {
                        reference: 'heading-ref',
                        level: 2,
                    },
                    alignment: AlignmentType.JUSTIFIED,
                    indent: { ...defaultIndent },
                    spacing: { ...defaultSpacing },
                },
                run: { ...defaultFont, bold: true },
            },
        },
        paragraphStyles: [
            {
                id: 'code',
                name: 'code',
                paragraph: {
                    spacing: {
                        before: docx.convertMillimetersToTwip(
                            defaultTableSpacingMm,
                        ),
                    },
                    keepLines: true,
                    keepNext: true,
                    indent: {
                        firstLine: 0,
                    },
                },
                run: {
                    size: fontSizeToDocxFontSize(12),
                    font: 'Fira Code',
                },
            },
            {
                id: 'table-caption',
                name: 'table-caption',
                run: {},
                paragraph: {
                    spacing: {
                        before: docx.convertMillimetersToTwip(
                            defaultPictureSpacingMm,
                        ),
                    },
                    indent: {
                        firstLine: 0,
                    },
                },
            },
            {
                id: 'table',
                name: 'table',
                paragraph: {
                    spacing: {
                        after: docx.convertMillimetersToTwip(
                            defaultTableSpacingMm,
                        ),
                    },
                    indent: {
                        firstLine: 0,
                    },
                },
            },
            {
                id: 'table-cell',
                name: 'table-cell',
                paragraph: {
                    alignment: AlignmentType.CENTER,
                    indent: {
                        firstLine: 0,
                    },
                },
            },
            {
                id: 'picture-caption',
                name: 'picture-caption',
                run: {},
                paragraph: {
                    alignment: AlignmentType.CENTER,
                    spacing: {
                        after: docx.convertMillimetersToTwip(
                            defaultPictureSpacingMm,
                        ),
                    },
                    indent: {
                        firstLine: 0,
                    },
                },
            },
            {
                id: 'picture',
                name: 'picture',
                paragraph: {
                    keepNext: true,
                    alignment: AlignmentType.CENTER,
                    spacing: {
                        before: docx.convertMillimetersToTwip(
                            defaultPictureSpacingMm,
                        ),
                    },
                    indent: {
                        firstLine: 0,
                    },
                },
            },
            {
                id: 'formula-picture',
                name: 'formula-picture',
                paragraph: {
                    alignment: AlignmentType.CENTER,
                    spacing: {
                        before: docx.convertMillimetersToTwip(
                            defaultPictureSpacingMm,
                        ),
                        after: docx.convertMillimetersToTwip(
                            defaultPictureSpacingMm,
                        ),
                    },
                    indent: {
                        firstLine: 0,
                    },
                },
            },
            {
                id: 'formula-table-cell',
                name: 'formula-table-cell',
                paragraph: {
                    alignment: AlignmentType.CENTER,
                    indent: {
                        firstLine: 0,
                    },
                },
            },
            {
                id: 'formula-table-cell-number',
                name: 'formula-table-cell-number',
                paragraph: {
                    alignment: AlignmentType.CENTER,
                    indent: {
                        firstLine: 0,
                    },
                },
            },
        ],
    };
}
