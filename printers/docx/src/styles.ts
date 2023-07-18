import * as docx from 'docx';
import { AlignmentType } from 'docx';

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
                        reference: HEADING_REF_NAME,
                        level: 0,
                    },
                    alignment: AlignmentType.CENTER,
                    indent: { firstLine: 0 },
                    spacing: { ...defaultSpacing },
                    keepNext: true,
                },
                run: { ...defaultFont, bold: true, allCaps: true },
            },
            heading2: {
                paragraph: {
                    numbering: {
                        reference: HEADING_REF_NAME,
                        level: 1,
                    },
                    alignment: AlignmentType.JUSTIFIED,
                    indent: { ...defaultIndent },
                    spacing: { ...defaultSpacing },
                    keepNext: true,
                },
                run: { ...defaultFont, bold: true },
            },
            heading3: {
                paragraph: {
                    numbering: {
                        reference: HEADING_REF_NAME,
                        level: 2,
                    },
                    alignment: AlignmentType.JUSTIFIED,
                    indent: { ...defaultIndent },
                    spacing: { ...defaultSpacing },
                    keepNext: true,
                },
                run: { ...defaultFont, bold: true },
            },
        },
        paragraphStyles: [
            // Default
            {
                id: 'tocheading',
                name: 'TOC Heading',
                paragraph: {
                    alignment: AlignmentType.CENTER,
                    indent: { firstLine: 0 },
                    spacing: { ...defaultSpacing },
                    keepNext: true,
                },
                run: { ...defaultFont, bold: true, allCaps: true },
            },
            {
                id: 'toc 1',
                name: 'TOC 1',
                paragraph: {
                    indent: { firstLine: 0, start: 0 },
                    spacing: { ...defaultSpacing },
                },
                run: { ...defaultFont, allCaps: true },
            },
            {
                id: 'toc 2',
                name: 'TOC 2',
                paragraph: {
                    indent: {
                        firstLine: docx.convertMillimetersToTwip(12.5),
                        start: 0,
                    },
                    spacing: { ...defaultSpacing },
                },
                run: { ...defaultFont },
            },
            {
                id: 'toc 3',
                name: 'TOC 3',
                paragraph: {
                    indent: {
                        firstLine: docx.convertMillimetersToTwip(25.0),
                        start: 0,
                    },
                    spacing: { ...defaultSpacing },
                },
                run: { ...defaultFont },
            },

            // Custom
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
                    alignment: AlignmentType.LEFT,
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

interface NumberingLevelSpacing {
    tabStop: number;
    firstLine: number;
}

const numberingLevelsSpacings = (level: number) =>
    ({
        tabStop: docx.convertMillimetersToTwip(level * 15 + 10),
        firstLine: docx.convertMillimetersToTwip(level * 15),
    } as NumberingLevelSpacing);

export function getOrderedNumberingLevels(): docx.ILevelsOptions[] {
    return [
        {
            level: 0,
            format: docx.LevelFormat.RUSSIAN_LOWER,
            text: '%1)',
            alignment: docx.AlignmentType.START,
            style: {
                paragraph: {
                    leftTabStop: numberingLevelsSpacings(1).tabStop,
                    indent: {
                        firstLine: numberingLevelsSpacings(1).firstLine,
                    },
                },
            },
        },
        {
            level: 1,
            format: docx.LevelFormat.DECIMAL,
            text: '%2)',
            alignment: docx.AlignmentType.START,
            style: {
                paragraph: {
                    leftTabStop: numberingLevelsSpacings(2).tabStop,
                    indent: {
                        firstLine: numberingLevelsSpacings(2).firstLine,
                    },
                },
            },
        },
        {
            level: 2,
            format: docx.LevelFormat.UPPER_ROMAN,
            text: '%3)',
            alignment: docx.AlignmentType.START,
            style: {
                paragraph: {
                    leftTabStop: numberingLevelsSpacings(3).tabStop,
                    indent: {
                        firstLine: numberingLevelsSpacings(3).firstLine,
                    },
                },
            },
        },
    ];
}

export function getUnorderedNumberingLevels(): docx.ILevelsOptions[] {
    return [
        {
            level: 0,
            format: docx.LevelFormat.NONE,
            text: '-',
            alignment: docx.AlignmentType.START,
            style: {
                paragraph: {
                    leftTabStop: numberingLevelsSpacings(1).tabStop,
                    indent: {
                        firstLine: numberingLevelsSpacings(1).firstLine,
                    },
                },
            },
        },
        {
            level: 1,
            format: docx.LevelFormat.RUSSIAN_LOWER,
            text: '%2)',
            alignment: docx.AlignmentType.START,
            style: {
                paragraph: {
                    leftTabStop: numberingLevelsSpacings(2).tabStop,
                    indent: {
                        firstLine: numberingLevelsSpacings(2).firstLine,
                    },
                },
            },
        },
        {
            level: 2,
            format: docx.LevelFormat.DECIMAL,
            text: '%3)',
            alignment: docx.AlignmentType.START,
            style: {
                paragraph: {
                    leftTabStop: numberingLevelsSpacings(3).tabStop,
                    indent: {
                        firstLine: numberingLevelsSpacings(3).firstLine,
                    },
                },
            },
        },
    ];
}

export type INumberingOptionsConfig = docx.INumberingOptions['config'][0];

const HEADING_REF_NAME = 'heading-ref';

export function getNumberingHeading(): INumberingOptionsConfig {
    return {
        reference: HEADING_REF_NAME,
        levels: [
            {
                level: 0,
                format: docx.LevelFormat.NONE,
                text: '',
                alignment: docx.AlignmentType.START,
                style: {
                    paragraph: {
                        leftTabStop: docx.convertMillimetersToTwip(10),
                    },
                },
            },
            {
                level: 1,
                format: docx.LevelFormat.DECIMAL,
                text: '%2',
                alignment: docx.AlignmentType.START,
                style: {
                    paragraph: {
                        leftTabStop: docx.convertMillimetersToTwip(20 + 15),
                    },
                },
            },
            {
                level: 2,
                format: docx.LevelFormat.DECIMAL,
                text: '%2.%3',
                alignment: docx.AlignmentType.START,
                style: {
                    paragraph: {
                        leftTabStop: docx.convertMillimetersToTwip(20 + 15),
                    },
                },
            },
        ],
    };
}
