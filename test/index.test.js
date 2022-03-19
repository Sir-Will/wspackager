const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const tar = require('tar');
const wspackager = require('../lib/index.js');

const EXPECTED_FILE = 'com.example.test_v1.0.0-{test_name}.tar';

describe('usage tests', () => {
    const EXPECTED_CONTENT = [
        'files.tar',
        'templates.tar',
        'package.xml',
        'page.xml'
    ];

    test('it should create a tar.gz file (direct)', (done) => {
        new TestRunner('simple-package', EXPECTED_CONTENT).run(done);
    })
    test('it should create a tar.gz file (cli)', (done) => {
        new TestRunner('simple-package', EXPECTED_CONTENT).runCli(done);
    })
})

describe('include package tests', () => {
    const EXPECTED_CONTENT = [
        'files.tar',
        'templates.tar',
        'package.xml',
        'page.xml',
        'requirements/',
        'requirements/com.example.test.tar.gz'
    ];

    test('it should include requirements', (done) => {
        new TestRunner('include-package',
            EXPECTED_CONTENT.concat('requirements/com.example.test.tar')
        ).run(done);
    })
})


class TestRunner {

    constructor(testCasePath, expectedContent) {
        this.testCasePath = testCasePath;
        this.expectedContent = expectedContent;
    }

    run(done) {
        const outputFilename = EXPECTED_FILE.replace('{test_name}', 'direct');
        const packageDir = this.#getTestPackagePath(false);
        this.#deletePreviousTestBuild(outputFilename, () => { 
            try {
                wspackager.run({
                    cwd: __dirname,
                    source: packageDir,
                    destination: path.join(packageDir, outputFilename)
                })
                .then((result) => {
                    try {
                        this.#expectPackageBuild(result.filename)
                        done()
                    } catch (error) {
                        done(error)
                    }
                })
                .catch((error) => {
                    done(error)
                });
            } catch(error) {
                done(error)
            }
        });
    }

    runCli(done) {
        const outputFilename = EXPECTED_FILE.replace('{test_name}', 'cli');

        this.#deletePreviousTestBuild(outputFilename, () => {

            const command = `cd ${this.#getTestPackagePath()} && node ../../lib/bin.js -d ${outputFilename}`;

            const child = exec(command, (err, stdout, stderr) => {
                if (err) {
                    done(err)
                    return;
                }
                if (stderr) {
                    done(stderr)
                    return;
                }
                console.debug(stdout);
            })

            child.on('close', () => {
                try {
                    this.#expectPackageBuild(outputFilename)
                    done()
                } catch (error) {
                    done(error)
                }
            })
        });
    }

    #getTestPackagePath(absolutePath = true) {
        const dir = this.testCasePath;
        if (absolutePath) {
            return path.join(__dirname, dir)
        }
        return dir;
    }
    
    #deletePreviousTestBuild(filename, callback) {
        fs.unlink(path.join(this.#getTestPackagePath(), filename), err => callback());
    }
    
    #expectPackageBuild(filename) {
        const createdPackage = path.join(this.#getTestPackagePath(), filename);
        expect(fs.existsSync(createdPackage)).toBe(true)
    
        let content = [];
    
        tar.t({
            file: createdPackage,
            onentry: entry => {
                content.push(entry.path);
            },
            sync: true
        })
        expect(this.expectedContent.sort()).toEqual(content.sort());
    }
}