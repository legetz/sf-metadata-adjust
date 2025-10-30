import { expect } from 'chai';
import { sortXmlElements, sortClassAccesses, sortArrayElements } from '../../../src/common/xml/sorter.js';

describe('common/xml/sorter', () => {
    describe('sortClassAccesses', () => {
        it('should sort class accesses case-sensitively (uppercase before lowercase)', () => {
            const input = [
                { apexClass: ['TestClass'] },
                { apexClass: ['testClass'] },
                { apexClass: ['AnotherClass'] },
                { apexClass: ['anotherClass'] }
            ];

            const result = sortClassAccesses(input);

            expect(result[0].apexClass[0]).to.equal('AnotherClass');
            expect(result[1].apexClass[0]).to.equal('TestClass');
            expect(result[2].apexClass[0]).to.equal('anotherClass');
            expect(result[3].apexClass[0]).to.equal('testClass');
        });

        it('should handle empty apexClass values', () => {
            const input = [
                { apexClass: ['ZClass'] },
                { apexClass: [''] },
                { apexClass: ['AClass'] }
            ];

            const result = sortClassAccesses(input);

            expect(result[0].apexClass[0]).to.equal('');
            expect(result[1].apexClass[0]).to.equal('AClass');
            expect(result[2].apexClass[0]).to.equal('ZClass');
        });
    });

    describe('sortArrayElements', () => {
        it('should sort fieldPermissions case-sensitively', () => {
            const input = [
                { field: ['Test.Example__c'] },
                { field: ['Test.Exampleone__c'] },
                { field: ['Test.ExampleOne__c'] },
                { field: ['Test.Examplethree__c'] },
                { field: ['Test.ExampleTwo__c'] }
            ];

            const result = sortArrayElements(input, 'fieldPermissions');

            expect(result[0].field[0]).to.equal('Test.ExampleOne__c');
            expect(result[1].field[0]).to.equal('Test.ExampleTwo__c');
            expect(result[2].field[0]).to.equal('Test.Example__c');
            expect(result[3].field[0]).to.equal('Test.Exampleone__c');
            expect(result[4].field[0]).to.equal('Test.Examplethree__c');
        });

        it('should sort customPermissions by name case-sensitively', () => {
            const input = [
                { name: ['ViewData'] },
                { name: ['viewData'] },
                { name: ['EditRecords'] },
                { name: ['editRecords'] }
            ];

            const result = sortArrayElements(input, 'customPermissions');

            expect(result[0].name[0]).to.equal('EditRecords');
            expect(result[1].name[0]).to.equal('ViewData');
            expect(result[2].name[0]).to.equal('editRecords');
            expect(result[3].name[0]).to.equal('viewData');
        });

        it('should sort objectPermissions by object name case-sensitively', () => {
            const input = [
                { object: ['Contact'] },
                { object: ['contact__c'] },
                { object: ['Account'] },
                { object: ['account__c'] }
            ];

            const result = sortArrayElements(input, 'objectPermissions');

            expect(result[0].object[0]).to.equal('Account');
            expect(result[1].object[0]).to.equal('Contact');
            expect(result[2].object[0]).to.equal('account__c');
            expect(result[3].object[0]).to.equal('contact__c');
        });

        it('should sort recordTypeVisibilities by recordType case-sensitively', () => {
            const input = [
                { recordType: ['Account.PersonAccount'] },
                { recordType: ['Account.BusinessAccount'] },
                { recordType: ['Account.businessAccount'] }
            ];

            const result = sortArrayElements(input, 'recordTypeVisibilities');

            expect(result[0].recordType[0]).to.equal('Account.BusinessAccount');
            expect(result[1].recordType[0]).to.equal('Account.PersonAccount');
            expect(result[2].recordType[0]).to.equal('Account.businessAccount');
        });

        it('should sort generic arrays by first suitable key case-sensitively', () => {
            const input = [
                { name: ['Zebra'] },
                { name: ['zebra'] },
                { name: ['Apple'] },
                { name: ['apple'] }
            ];

            const result = sortArrayElements(input, 'genericArray');

            expect(result[0].name[0]).to.equal('Apple');
            expect(result[1].name[0]).to.equal('Zebra');
            expect(result[2].name[0]).to.equal('apple');
            expect(result[3].name[0]).to.equal('zebra');
        });
    });

    describe('sortXmlElements', () => {
        it('should sort object keys case-sensitively', () => {
            const input = {
                zebra: 'value1',
                Zebra: 'value2',
                apple: 'value3',
                Apple: 'value4'
            };

            const result = sortXmlElements(input);

            const keys = Object.keys(result);
            expect(keys[0]).to.equal('Apple');
            expect(keys[1]).to.equal('Zebra');
            expect(keys[2]).to.equal('apple');
            expect(keys[3]).to.equal('zebra');
        });

        it('should recursively sort nested objects case-sensitively', () => {
            const input = {
                parent: {
                    zebra: 'value1',
                    Zebra: 'value2',
                    apple: 'value3',
                    Apple: 'value4'
                }
            };

            const result = sortXmlElements(input);

            const parentKeys = Object.keys(result.parent);
            expect(parentKeys[0]).to.equal('Apple');
            expect(parentKeys[1]).to.equal('Zebra');
            expect(parentKeys[2]).to.equal('apple');
            expect(parentKeys[3]).to.equal('zebra');
        });

        it('should handle classAccesses array with case-sensitive sorting', () => {
            const input = {
                classAccesses: [
                    { apexClass: ['ZClass'] },
                    { apexClass: ['AClass'] },
                    { apexClass: ['aClass'] }
                ]
            };

            const result = sortXmlElements(input);

            expect(result.classAccesses[0].apexClass[0]).to.equal('AClass');
            expect(result.classAccesses[1].apexClass[0]).to.equal('ZClass');
            expect(result.classAccesses[2].apexClass[0]).to.equal('aClass');
        });

        it('should handle fieldPermissions array with case-sensitive sorting', () => {
            const input = {
                fieldPermissions: [
                    { field: ['Test.Example__c'] },
                    { field: ['Test.Exampleone__c'] },
                    { field: ['Test.ExampleOne__c'] },
                    { field: ['Test.Examplethree__c'] },
                    { field: ['Test.ExampleTwo__c'] }
                ]
            };

            const result = sortXmlElements(input);

            expect(result.fieldPermissions[0].field[0]).to.equal('Test.ExampleOne__c');
            expect(result.fieldPermissions[1].field[0]).to.equal('Test.ExampleTwo__c');
            expect(result.fieldPermissions[2].field[0]).to.equal('Test.Example__c');
            expect(result.fieldPermissions[3].field[0]).to.equal('Test.Exampleone__c');
            expect(result.fieldPermissions[4].field[0]).to.equal('Test.Examplethree__c');
        });

        it('should handle null and undefined values', () => {
            expect(sortXmlElements(null)).to.be.null;
            expect(sortXmlElements(undefined)).to.be.undefined;
        });

        it('should handle primitive values', () => {
            expect(sortXmlElements('string')).to.equal('string');
            expect(sortXmlElements(123)).to.equal(123);
            expect(sortXmlElements(true)).to.equal(true);
        });

        it('should handle mixed case field names correctly', () => {
            const input = {
                fieldPermissions: [
                    { field: ['Account.Name'] },
                    { field: ['Account.name'] },
                    { field: ['Account.AccountNumber'] },
                    { field: ['Account.accountNumber'] }
                ]
            };

            const result = sortXmlElements(input);

            // Uppercase 'A' and 'N' should come before lowercase 'a' and 'n'
            expect(result.fieldPermissions[0].field[0]).to.equal('Account.AccountNumber');
            expect(result.fieldPermissions[1].field[0]).to.equal('Account.Name');
            expect(result.fieldPermissions[2].field[0]).to.equal('Account.accountNumber');
            expect(result.fieldPermissions[3].field[0]).to.equal('Account.name');
        });

        it('should handle complex nested structure with arrays and objects', () => {
            const input = {
                zebra: 'value',
                Apple: 'value',
                fieldPermissions: [
                    { field: ['Test.zField'] },
                    { field: ['Test.AField'] }
                ],
                customPermissions: [
                    { name: ['ViewData'] },
                    { name: ['viewData'] }
                ]
            };

            const result = sortXmlElements(input);

            const keys = Object.keys(result);
            expect(keys[0]).to.equal('Apple');
            expect(keys[1]).to.equal('customPermissions');
            expect(keys[2]).to.equal('fieldPermissions');
            expect(keys[3]).to.equal('zebra');

            expect(result.fieldPermissions[0].field[0]).to.equal('Test.AField');
            expect(result.fieldPermissions[1].field[0]).to.equal('Test.zField');

            expect(result.customPermissions[0].name[0]).to.equal('ViewData');
            expect(result.customPermissions[1].name[0]).to.equal('viewData');
        });
    });

    describe('Case-sensitive sorting validation', () => {
        it('should validate the exact example from requirements', () => {
            const input = [
                { field: ['Example__c'] },
                { field: ['ExampleOne__c'] },
                { field: ['Exampleone__c'] },
                { field: ['Examplethree__c'] },
                { field: ['ExampleTwo__c'] }
            ];

            const result = sortArrayElements(input, 'fieldPermissions');

            // Expected output: ExampleOne__c, ExampleTwo__c, Example__c, Exampleone__c, Examplethree__c
            expect(result[0].field[0]).to.equal('ExampleOne__c');
            expect(result[1].field[0]).to.equal('ExampleTwo__c');
            expect(result[2].field[0]).to.equal('Example__c');
            expect(result[3].field[0]).to.equal('Exampleone__c');
            expect(result[4].field[0]).to.equal('Examplethree__c');
        });
    });
});
