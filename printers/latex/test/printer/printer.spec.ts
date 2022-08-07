import { parseFile } from '@md-to-latex/converter/dist/ast/parsing';
import { applyMacrosFull } from '@md-to-latex/converter/dist/macro';
import { buildConfig, createPrinterLatex } from '../../src';
import { DiagnoseList } from '@md-to-latex/converter/dist/diagnostic';
import { YAXMLatexPrinterConfig } from '../../src/config';

function processingChain(
    text: string,
    config?: Partial<YAXMLatexPrinterConfig>,
): {
    result: string;
    diagnostic: DiagnoseList;
} {
    const { result: fileNode, diagnostic: fileDiagnostic } = parseFile(
        text,
        'filepath',
    );

    const macroDiagnostic = applyMacrosFull(fileNode);

    const printer = createPrinterLatex(buildConfig(config));
    const { result, diagnostic: printerDiagnostic } = printer.processNode(
        printer,
        fileNode,
    );

    return {
        result,
        diagnostic: [
            ...fileDiagnostic,
            ...macroDiagnostic,
            ...printerDiagnostic,
        ],
    };
}

describe('simple md to latex docs printer', () => {
    test('Paragraph', () => {
        const result = processingChain(`
# Header

Text
`);
        expect(result.diagnostic).toHaveLength(0);
        expect(result.result).toMatchSnapshot();
    });

    test('Subheader + List + Code Span', () => {
        const result = processingChain(`
# Header

- A
- B
- C

## Subheader

1. X
2. Y
    1. T
        - 600
        - 700
    2. \`Code_span\`
3. Z
`);
        expect(result.diagnostic).toHaveLength(0);
        expect(result.result).toMatchSnapshot();
    });

    test('Header + Image + Code + Image', () => {
        const result = processingChain(`
# Header

![img-1](./assets/img/dolphin.png)(Image name)(@h 5cm)

\`\`\`python[code-1](Python Sample Code)
def main():
    print "Hello World"
\`\`\`

![img-2](./assets/img/dolphin.png)(Image name 2)(@h 7cm)
`);

        expect(result.diagnostic).not.toHaveLength(0);
        expect(result.diagnostic).toMatchSnapshot();
        expect(result.result).toMatchSnapshot();
    });

    test('Del node', () => {
        const result = processingChain(`
Test==node *what* hell==yeah we~ll.
        `);

        expect(result.diagnostic).toHaveLength(0);
        expect(result.result).toMatchSnapshot();
    });

    test('Code + Code', () => {
        const result = processingChain(`
# Header

Code in !PK[code-1] и !PK[code-2].


\`\`\`python[code-1](Python Sample Code)
def main():
    print "Hello World"
\`\`\`

\`\`\`python[code-2](Python Sample Code 2)
def hello_world():
    print "Hello World"
\`\`\`
`);

        expect(result.diagnostic).toHaveLength(0);
        expect(result.result).toMatchSnapshot();
    });

    test('Table', () => {
        const result = processingChain(`
Demonstrated in table !TK[table].

!T[table](Table with content)

|a|b|c|d|
|---|---|---|---|
|1|2|3|4|
|t|r|e|z|
`);

        expect(result.diagnostic).toHaveLength(0);
        expect(result.result).toMatchSnapshot();
    });

    test('Header + Formula', () => {
        const result = processingChain(`
# Header

$$$math
    a = b + c
$$$
`);

        expect(result.diagnostic).toHaveLength(0);
        expect(result.result).toMatchSnapshot();
    });

    test('Inline formula must be wrapped with spaces', () => {
        const result = processingChain(`
Inlined formula $\`\\sigma^2_w(t)=\\omega_0(t)\\sigma^2_0(t)+\\omega_1(t)\\sigma^2_1(t)\`$
into the sentence.
`);

        expect(result.diagnostic).toHaveLength(0);
        expect(result.result).toMatchSnapshot();
    });

    test('bold and italic', () => {
        const result = processingChain(`**Bold**: *testing*`);

        expect(result.diagnostic).toHaveLength(0);
        expect(result.result).toMatchSnapshot();
    });

    test('ListItem + Br + Text must have 2 line breaks', () => {
        const result = processingChain(`1. Item  
New Line

2. New Item`);

        expect(result.diagnostic).toHaveLength(0);
        expect(result.result).toMatchSnapshot();
    });

    test('ListItem + MathLatex must have 2 line breaks', () => {
        const result = processingChain(`1. Text  
$$$math
Some text here
$$$`);

        expect(result.diagnostic).toHaveLength(0);
        expect(result.result).toMatchSnapshot();
    });
});

describe('Applications', () => {
    test('with list', () => {
        const result = processingChain(`\
!AC[code-full](@dir ./assets/code)(@file template-full.py)(@lang python)
!AC[code-full2](@dir ./assets/code)(@file template-full2.py)(@lang python)
!APR[picture-large](Large scheme)(./assets/img/circuit.png)
        
# Header

Code from application !AK[code-full2] describes image from application !AK[picture-large].

See application !AK[code-full].

# Applications

!LAA[]
`);

        expect(result.diagnostic).toHaveLength(0);
        expect(result.result).toMatchSnapshot();
    });

    test('with multiple columns', () => {
        const result = processingChain(`
!AC[code-full](@dir ./assets/code)(@file template-full.py)(@lang python)(@c 2)
        
# Header

See application !AK[code-full].

# Applications

!LAA[]
`);

        expect(result.diagnostic).toHaveLength(0);
        expect(result.result).toMatchSnapshot();
    });

    test('Unused application, should throw error', () => {
        const result = processingChain(`
!AC[code-full](./assets/code)(template-full.py)(python)

!LAA[]
`);

        expect(result.diagnostic).not.toHaveLength(0);
        expect(result.diagnostic).toMatchSnapshot();
        expect(result.result).toMatchSnapshot();
    });

    test('Undefined application, should throw error', () => {
        const result = processingChain(`
!AK[nope]
`);

        expect(result.diagnostic).not.toHaveLength(0);
        expect(result.diagnostic).toMatchSnapshot();
        expect(result.result).toMatchSnapshot();
    });
});

describe('References', () => {
    test('with list', () => {
        const result = processingChain(`
!R[ref-1](
    H.~Y.~~Ignat. <<Reference~~1>> // Some Journal, 1867
)

!R[ref-2](
    H.~Y.~~Ignat. <<Reference~~2>> // Some Journal, 1867
)

# Header

Code from reference !RK[ref-2] describes image from reference !RK[ref-1].

# References

!LAR[]
`);

        expect(result.diagnostic).toHaveLength(0);
        expect(result.result).toMatchSnapshot();
    });

    test('Unused reference, should throw error', () => {
        const result = processingChain(`
!R[ref](
    A.~A.~~Amogus. <<Impostor~~theorem>> // Steam library, 2021
)

!LAR[]
`);

        expect(result.diagnostic).not.toHaveLength(0);
        expect(result.diagnostic).toMatchSnapshot();
        expect(result.result).toMatchSnapshot();
    });

    test('Undefined reference, should throw error', () => {
        const result = processingChain(`
!RK[nope]
`);

        expect(result.diagnostic).not.toHaveLength(0);
        expect(result.diagnostic).toMatchSnapshot();
        expect(result.result).toMatchSnapshot();
    });
});

describe('complex latex', function () {
    test('Inline math', () => {
        const result = processingChain(`
Text $\`a = b + \\sum_{i=0}^\\infty c_i\`$ ending.
`);

        expect(result.diagnostic).toHaveLength(0);
        expect(result.result).toMatchSnapshot();

        expect(result.result)
            .toEqual(`Text $\\displaystyle a = b + \\sum_{i=0}^\\infty c_i$ ending.
`);
    });

    test('Text with percents', () => {
        const result = processingChain(`
Text with 10% number.
`);

        expect(result.diagnostic).toHaveLength(0);
        expect(result.result).toMatchSnapshot();
    });

    test('Text with escapes ("<" sound be corrent also)', () => {
        const result = processingChain(`
Text with \\<assdasd.
`);

        expect(result.diagnostic).toHaveLength(0);
        expect(result.result).toMatchSnapshot();
    });

    test('Tag <hr> should break the page', () => {
        const result = processingChain(`
The first page

---------------------------------------

The second page
`);

        expect(result.diagnostic).toHaveLength(0);
        expect(result.result).toMatchSnapshot();
    });

    test('Tag <br> should put additional break', () => {
        const result = processingChain(`
The first line  
The second line
`);

        expect(result.diagnostic).toHaveLength(0);
        expect(result.result).toMatchSnapshot();
    });

    test("Text ' dereplacement", () => {
        const result = processingChain(`
Otsu's method is a one-dimensional discrete analog of Fisher's 
Discriminant Analysis, is related to Jenks optimization method.
`);

        expect(result.diagnostic).toHaveLength(0);
        expect(result.result).toMatchSnapshot();
    });

    test('CodeSpan dereplacement', () => {
        const result = processingChain('`"sample & text"`');

        expect(result.diagnostic).toHaveLength(0);
        expect(result.result).toMatchSnapshot();
    });

    test('Inline latex math dereplacement', () => {
        const result = processingChain(`
$\`a > b < c\`$
`);

        expect(result.diagnostic).toHaveLength(0);
        expect(result.result).toMatchSnapshot();
    });

    test('Table and picture key', () => {
        const result = processingChain(`
Displayed in picture !PK[gray-square] (!PK[gray-square]) and table !TK[table].

![gray-square](./assets/img/example.png)(Gray square)(@h 5cm)

!T[table](Table)
        
|Key    |Value |
|-------|------|
|Static number | 50 |
|Random number | $$ \\showcaserandomnumber $$ |
`);

        expect(result.diagnostic).toHaveLength(0);
        expect(result.result).toMatchSnapshot();
    });
});

describe('latex picture after table (#52)', function () {
    // See https://github.com/markdown-to-latex/converter/issues/52
    test('Picture right after the table', () => {
        const result = processingChain(
            `!T[table](Table example)

| Key           | Value                       |
| ------------- | --------------------------- |
| Static number | 50                          |

![gray-square](./assets/img/example.png)(Gray square)(@h 5cm)`,
        );

        expect(result.diagnostic).not.toHaveLength(0);
        expect(result.diagnostic).toMatchSnapshot();
        expect(result.result).toMatchSnapshot();
    });

    test('Table + text + picture', () => {
        const result = processingChain(
            `!T[table](Table example)

| Key           | Value                       |
| ------------- | --------------------------- |
| Static number | 50                          |

Sample text line

![gray-square](./assets/img/example.png)(Gray square)(@h 5cm)`,
        );

        expect(result.diagnostic).not.toHaveLength(0);
        expect(result.diagnostic).toMatchSnapshot();
        expect(result.result).toMatchSnapshot();
    });
});

describe('url variants', () => {
    test('Default url', () => {
        const result = processingChain(
            '[](https://example.com/index_page.html?asd=asdasd&gege=gegege#header)',
        );

        expect(result.diagnostic).toHaveLength(0);
        expect(result.result).toMatchSnapshot();
    });

    test('Bold url', () => {
        const result = processingChain(
            '[](https://example.com/index_page.html?asd=asdasd&gege=gegege#header)',
            {
                useLinkAs: 'bold',
            },
        );

        expect(result.diagnostic).toHaveLength(0);
        expect(result.result).toMatchSnapshot();
    });

    test('Italic url', () => {
        const result = processingChain(
            '[](https://example.com/index_page.html?asd=asdasd&gege=gegege#header)',
            {
                useLinkAs: 'italic',
            },
        );

        expect(result.diagnostic).toHaveLength(0);
        expect(result.result).toMatchSnapshot();
    });

    test('Underlined url', () => {
        const result = processingChain(
            '[](https://example.com/index_page.html?asd=asdasd&gege=gegege#header)',
            {
                useLinkAs: 'underline',
            },
        );

        expect(result.diagnostic).toHaveLength(0);
        expect(result.result).toMatchSnapshot();
    });

    test('No escape & code url', () => {
        const result = processingChain(
            '[](https://example.com/index_page.html?asd=asdasd&asdasd=gege#header)',
            {
                useLinkAs: 'monospace',
                defaultAutoEscapes: false,
            },
        );

        expect(result.diagnostic).toHaveLength(0);
        expect(result.result).toMatchSnapshot();
    });
});

describe('Escapes', () => {
    test('Default escapes', () => {
        const result = processingChain(`
# Header

[Link name](https://testing.url/com?some=thing&wtf#xdxdxd)

The "definition" increased by 1% (more text more text).
    `);

        expect(result.diagnostic).toHaveLength(0);
        expect(result.result).toMatchSnapshot();
    });
});

describe('CodeSpan', () => {
    test('Monospace', () => {
        const result = processingChain('CodeSpan `text & text`.', {
            useCodeSpanAs: 'monospace',
        });

        expect(result.diagnostic).toHaveLength(0);
        expect(result.result).toMatchSnapshot();
    });

    test('Quote', () => {
        const result = processingChain('CodeSpan `text & text`.', {
            useCodeSpanAs: 'quotes',
        });

        expect(result.diagnostic).toHaveLength(0);
        expect(result.result).toMatchSnapshot();
    });
});
