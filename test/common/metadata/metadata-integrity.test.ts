import { expect } from "chai";
import {
  classifyRemovedMetadataFile,
  buildRemovedMetadataIndex,
  findIntegrityIssuesInMetadata,
  findCustomFieldIssuesInContent,
  findIntegrityIssuesInSource,
  createManualRemovedItem,
  RemovedMetadataItem
} from "../../../src/common/metadata/metadata-integrity.js";
import { parseMetadataXml } from "../../../src/common/xml/xml-helpers.js";

describe("metadata-integrity", () => {
  it("classifies removed Apex class files", () => {
    const result = classifyRemovedMetadataFile("force-app/main/default/classes/Example.cls");
    expect(result).to.deep.equal({
      type: "ApexClass",
      name: "Example",
      referenceKey: "Example",
      sourceFile: "force-app/main/default/classes/Example.cls"
    });
  });

  it("classifies removed custom field files", () => {
    const result = classifyRemovedMetadataFile(
      "force-app/main/default/objects/Account/fields/Sample__c.field-meta.xml"
    );
    expect(result).to.deep.equal({
      type: "CustomField",
      name: "Account.Sample__c",
      referenceKey: "Account.Sample__c",
      sourceFile: "force-app/main/default/objects/Account/fields/Sample__c.field-meta.xml"
    });
  });

  it("classifies removed Visualforce page files", () => {
    const result = classifyRemovedMetadataFile("force-app/main/default/pages/Obsolete.page");
    expect(result).to.deep.equal({
      type: "VisualforcePage",
      name: "Obsolete",
      referenceKey: "Obsolete",
      sourceFile: "force-app/main/default/pages/Obsolete.page"
    });
  });

  it("creates manual Apex class removed items", () => {
    const result = createManualRemovedItem("LegacyService");
    expect(result).to.deep.equal({
      type: "ApexClass",
      name: "LegacyService",
      referenceKey: "LegacyService",
      sourceFile: "manual:LegacyService"
    });
  });

  it("creates manual custom field removed items", () => {
    const result = createManualRemovedItem("Account.Legacy__c");
    expect(result).to.deep.equal({
      type: "CustomField",
      name: "Account.Legacy__c",
      referenceKey: "Account.Legacy__c",
      sourceFile: "manual:Account.Legacy__c"
    });
  });

  it("returns null for invalid manual identifiers", () => {
    expect(createManualRemovedItem("")).to.equal(null);
    expect(createManualRemovedItem("Account.")).to.equal(null);
    expect(createManualRemovedItem("123Invalid")).to.equal(null);
  });

  it("ignores unrelated file paths", () => {
    const result = classifyRemovedMetadataFile("force-app/main/default/labels/Custom.labels-meta.xml");
    expect(result).to.equal(null);
  });

  it("detects references to removed Apex classes", async () => {
    const removedItems: RemovedMetadataItem[] = [
      {
        type: "ApexClass",
        name: "ObsoleteService",
        referenceKey: "ObsoleteService",
        sourceFile: "force-app/main/default/classes/ObsoleteService.cls"
      }
    ];
    const index = buildRemovedMetadataIndex(removedItems);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <Profile xmlns="http://soap.sforce.com/2006/04/metadata">
            <classAccesses>
                <apexClass>ObsoleteService</apexClass>
                <enabled>true</enabled>
            </classAccesses>
            <classAccesses>
                <apexClass>ActiveService</apexClass>
                <enabled>true</enabled>
            </classAccesses>
        </Profile>`;

    const metadata = await parseMetadataXml(xml);
    const issues = findIntegrityIssuesInMetadata(metadata, "profiles/Admin.profile-meta.xml", index);

    expect(issues).to.have.lengthOf(1);
    expect(issues[0]).to.include({
      type: "MissingApexClassReference",
      missingItem: "ObsoleteService",
      referencingFile: "profiles/Admin.profile-meta.xml"
    });
  });

  it("detects references to removed fields when access granted", async () => {
    const removedItems: RemovedMetadataItem[] = [
      {
        type: "CustomField",
        name: "Account.Legacy__c",
        referenceKey: "Account.Legacy__c",
        sourceFile: "force-app/main/default/objects/Account/fields/Legacy__c.field-meta.xml"
      }
    ];
    const index = buildRemovedMetadataIndex(removedItems);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
            <fieldPermissions>
                <editable>true</editable>
                <field>Account.Legacy__c</field>
                <readable>true</readable>
            </fieldPermissions>
            <fieldPermissions>
                <editable>false</editable>
                <field>Account.Active__c</field>
                <readable>true</readable>
            </fieldPermissions>
        </PermissionSet>`;

    const metadata = await parseMetadataXml(xml);
    const issues = findIntegrityIssuesInMetadata(metadata, "permissionsets/Admin.permissionset-meta.xml", index);

    expect(issues).to.have.lengthOf(1);
    expect(issues[0]).to.include({
      type: "MissingCustomFieldReference",
      missingItem: "Account.Legacy__c",
      referencingFile: "permissionsets/Admin.permissionset-meta.xml"
    });
  });

  it("ignores permissions when both readable and editable are false", async () => {
    const removedItems: RemovedMetadataItem[] = [
      {
        type: "CustomField",
        name: "Account.Legacy__c",
        referenceKey: "Account.Legacy__c",
        sourceFile: "force-app/main/default/objects/Account/fields/Legacy__c.field-meta.xml"
      }
    ];
    const index = buildRemovedMetadataIndex(removedItems);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <Profile xmlns="http://soap.sforce.com/2006/04/metadata">
            <fieldPermissions>
                <editable>false</editable>
                <field>Account.Legacy__c</field>
                <readable>false</readable>
            </fieldPermissions>
        </Profile>`;

    const metadata = await parseMetadataXml(xml);
    const issues = findIntegrityIssuesInMetadata(metadata, "profiles/Admin.profile-meta.xml", index);

    expect(issues).to.have.lengthOf(0);
  });

  it("detects Visualforce page references when access remains enabled", async () => {
    const removedItems: RemovedMetadataItem[] = [
      {
        type: "VisualforcePage",
        name: "LegacyPage",
        referenceKey: "LegacyPage",
        sourceFile: "force-app/main/default/pages/LegacyPage.page"
      }
    ];
    const index = buildRemovedMetadataIndex(removedItems);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <Profile xmlns="http://soap.sforce.com/2006/04/metadata">
            <pageAccesses>
                <apexPage>LegacyPage</apexPage>
                <enabled>true</enabled>
            </pageAccesses>
        </Profile>`;

    const metadata = await parseMetadataXml(xml);
    const issues = findIntegrityIssuesInMetadata(metadata, "profiles/Admin.profile-meta.xml", index);

    expect(issues).to.have.lengthOf(1);
    expect(issues[0]).to.include({
      type: "MissingVisualforcePageReference",
      missingItem: "LegacyPage",
      referencingFile: "profiles/Admin.profile-meta.xml"
    });
  });

  it("detects Apex class references in other Apex classes", () => {
    const removedItems: RemovedMetadataItem[] = [
      {
        type: "ApexClass",
        name: "LegacyService",
        referenceKey: "LegacyService",
        sourceFile: "force-app/main/default/classes/LegacyService.cls"
      }
    ];

    const index = buildRemovedMetadataIndex(removedItems);
    const content = "public class NewService { void exec() { LegacyService.doWork(); } }";
    const issues = findIntegrityIssuesInSource(content, "classes/NewService.cls", index);

    expect(issues).to.have.lengthOf(1);
    expect(issues[0]).to.include({
      type: "DanglingApexClassReference",
      missingItem: "LegacyService",
      referencingFile: "classes/NewService.cls"
    });
  });

  it("detects Apex class references in LWC imports", () => {
    const removedItems: RemovedMetadataItem[] = [
      {
        type: "ApexClass",
        name: "LegacyService",
        referenceKey: "LegacyService",
        sourceFile: "force-app/main/default/classes/LegacyService.cls"
      }
    ];

    const index = buildRemovedMetadataIndex(removedItems);
    const content = "import getData from '@salesforce/apex/LegacyService.fetchData';";
    const issues = findIntegrityIssuesInSource(content, "lwc/sample/sample.js", index);

    expect(issues).to.have.lengthOf(1);
    expect(issues[0]).to.include({
      type: "DanglingApexClassReference",
      missingItem: "LegacyService",
      referencingFile: "lwc/sample/sample.js"
    });
  });

  it("detects Apex class references in Aura markup", () => {
    const removedItems: RemovedMetadataItem[] = [
      {
        type: "ApexClass",
        name: "LegacyService",
        referenceKey: "LegacyService",
        sourceFile: "force-app/main/default/classes/LegacyService.cls"
      }
    ];

    const index = buildRemovedMetadataIndex(removedItems);
    const content = '<aura:component controller="LegacyService"></aura:component>';
    const issues = findIntegrityIssuesInSource(content, "aura/Sample/Sample.cmp", index);

    expect(issues).to.have.lengthOf(1);
    expect(issues[0]).to.include({
      type: "DanglingApexClassReference",
      missingItem: "LegacyService",
      referencingFile: "aura/Sample/Sample.cmp"
    });
  });

  it("detects Apex class references in flow definitions", () => {
    const removedItems: RemovedMetadataItem[] = [
      {
        type: "ApexClass",
        name: "LegacyService",
        referenceKey: "LegacyService",
        sourceFile: "force-app/main/default/classes/LegacyService.cls"
      }
    ];

    const index = buildRemovedMetadataIndex(removedItems);
    const content = `<flow:interview xmlns:flow="http://soap.sforce.com/2006/04/metadata">
        <actionCalls>
            <actionType>apex</actionType>
            <apexClass>LegacyService</apexClass>
            <apexMethod>doWork</apexMethod>
        </actionCalls>
    </flow:interview>`;
    const issues = findIntegrityIssuesInSource(content, "flows/Example.flow-meta.xml", index);

    expect(issues).to.have.lengthOf(1);
    expect(issues[0]).to.include({
      type: "DanglingApexClassReference",
      missingItem: "LegacyService",
      referencingFile: "flows/Example.flow-meta.xml"
    });
  });

  it("detects flow references to removed custom fields", () => {
    const removedItems: RemovedMetadataItem[] = [
      {
        type: "CustomField",
        name: "Account.Legacy__c",
        referenceKey: "Account.Legacy__c",
        sourceFile: "force-app/main/default/objects/Account/fields/Legacy__c.field-meta.xml"
      }
    ];
    const index = buildRemovedMetadataIndex(removedItems);
    const content = `<flow:interview xmlns:flow="http://soap.sforce.com/2006/04/metadata">
        <recordUpdates>
            <inputAssignments>
                <field>Account.Legacy__c</field>
            </inputAssignments>
        </recordUpdates>
    </flow:interview>`;

    const issues = findCustomFieldIssuesInContent(content, "flows/Example.flow-meta.xml", index, "Flow", "Account");
    expect(issues).to.have.lengthOf(1);
    expect(issues[0]).to.include({
      type: "MissingCustomFieldReference",
      missingItem: "Account.Legacy__c",
      referencingFile: "flows/Example.flow-meta.xml"
    });
  });

  it("ignores flow references to fields from other objects", () => {
    const removedItems: RemovedMetadataItem[] = [
      {
        type: "CustomField",
        name: "Asset.Legacy__c",
        referenceKey: "Asset.Legacy__c",
        sourceFile: "force-app/main/default/objects/Asset/fields/Legacy__c.field-meta.xml"
      }
    ];
    const index = buildRemovedMetadataIndex(removedItems);
    const content = `<flow:interview xmlns:flow="http://soap.sforce.com/2006/04/metadata">
        <recordUpdates>
            <inputAssignments>
                <field>Asset.Legacy__c</field>
            </inputAssignments>
        </recordUpdates>
    </flow:interview>`;

    const issues = findCustomFieldIssuesInContent(content, "flows/Example.flow-meta.xml", index, "Flow", "Account");
    expect(issues).to.have.lengthOf(0);
  });

  it("detects layout references to removed custom fields", () => {
    const removedItems: RemovedMetadataItem[] = [
      {
        type: "CustomField",
        name: "Account.Legacy__c",
        referenceKey: "Account.Legacy__c",
        sourceFile: "force-app/main/default/objects/Account/fields/Legacy__c.field-meta.xml"
      }
    ];
    const index = buildRemovedMetadataIndex(removedItems);
    const content = `<?xml version="1.0" encoding="UTF-8"?>
        <Layout xmlns="http://soap.sforce.com/2006/04/metadata">
            <layoutSections>
                <layoutColumns>
                    <layoutItems>
                        <field>Legacy__c</field>
                    </layoutItems>
                </layoutColumns>
            </layoutSections>
        </Layout>`;

    const issues = findCustomFieldIssuesInContent(
      content,
      "layouts/Account-Account_Layout.layout-meta.xml",
      index,
      "Layout",
      "Account"
    );
    expect(issues).to.have.lengthOf(1);
    expect(issues[0]).to.include({
      type: "MissingCustomFieldReference",
      missingItem: "Account.Legacy__c",
      referencingFile: "layouts/Account-Account_Layout.layout-meta.xml"
    });
  });

  it("ignores custom fields when layout object does not match", () => {
      const removedItems: RemovedMetadataItem[] = [
        {
          type: "CustomField",
          name: "Asset.Legacy__c",
          referenceKey: "Asset.Legacy__c",
          sourceFile: "force-app/main/default/objects/Asset/fields/Legacy__c.field-meta.xml"
        }
      ];
      const index = buildRemovedMetadataIndex(removedItems);
      const content = `<?xml version="1.0" encoding="UTF-8"?>
          <Layout xmlns="http://soap.sforce.com/2006/04/metadata">
              <layoutSections>
                  <layoutColumns>
                      <layoutItems>
                          <field>Legacy__c</field>
                      </layoutItems>
                  </layoutColumns>
              </layoutSections>
          </Layout>`;

      const issues = findCustomFieldIssuesInContent(
        content,
        "layouts/Account-Account_Layout.layout-meta.xml",
        index,
        "Layout",
        "Account"
      );
      expect(issues).to.have.lengthOf(0);
    });

  it("detects field set references to removed custom fields", () => {
    const removedItems: RemovedMetadataItem[] = [
      {
        type: "CustomField",
        name: "Account.Legacy__c",
        referenceKey: "Account.Legacy__c",
        sourceFile: "force-app/main/default/objects/Account/fields/Legacy__c.field-meta.xml"
      }
    ];
    const index = buildRemovedMetadataIndex(removedItems);
    const content = `<?xml version="1.0" encoding="UTF-8"?>
        <FieldSet xmlns="http://soap.sforce.com/2006/04/metadata">
            <displayedFields>
                <field>Legacy__c</field>
            </displayedFields>
        </FieldSet>`;

    const issues = findCustomFieldIssuesInContent(
      content,
      "objects/Account/fieldSets/Test.fieldSet-meta.xml",
      index,
      "Field Set",
      "Account"
    );
    expect(issues).to.have.lengthOf(1);
    expect(issues[0]).to.include({
      type: "MissingCustomFieldReference",
      missingItem: "Account.Legacy__c",
      referencingFile: "objects/Account/fieldSets/Test.fieldSet-meta.xml"
    });
  });

  it("detects Flexipage references to removed custom fields", () => {
    const removedItems: RemovedMetadataItem[] = [
      {
        type: "CustomField",
        name: "Account.Legacy__c",
        referenceKey: "Account.Legacy__c",
        sourceFile: "force-app/main/default/objects/Account/fields/Legacy__c.field-meta.xml"
      }
    ];
    const index = buildRemovedMetadataIndex(removedItems);
    const content = `<?xml version="1.0" encoding="UTF-8"?>
        <FlexiPage xmlns="http://soap.sforce.com/2006/04/metadata">
            <region>
                <componentInstance>
                    <componentName>force:relatedList</componentName>
                    <listView>Account.Legacy__c</listView>
                </componentInstance>
            </region>
        </FlexiPage>`;

    const issues = findCustomFieldIssuesInContent(
      content,
      "flexipages/Account_Record_Page.flexipage-meta.xml",
      index,
      "Flexipage"
    );
    expect(issues).to.have.lengthOf(1);
    expect(issues[0]).to.include({
      type: "MissingCustomFieldReference",
      missingItem: "Account.Legacy__c",
      referencingFile: "flexipages/Account_Record_Page.flexipage-meta.xml"
    });
  });

  it("detects compact layout references to removed custom fields", () => {
    const removedItems: RemovedMetadataItem[] = [
      {
        type: "CustomField",
        name: "Account.Legacy__c",
        referenceKey: "Account.Legacy__c",
        sourceFile: "force-app/main/default/objects/Account/fields/Legacy__c.field-meta.xml"
      }
    ];
    const index = buildRemovedMetadataIndex(removedItems);
    const content = `<?xml version="1.0" encoding="UTF-8"?>
        <CompactLayout xmlns="http://soap.sforce.com/2006/04/metadata">
            <fields>Legacy__c</fields>
        </CompactLayout>`;

    const issues = findCustomFieldIssuesInContent(
      content,
      "objects/Account/compactLayouts/Account.compactLayout-meta.xml",
      index,
      "Compact Layout",
      "Account"
    );
    expect(issues).to.have.lengthOf(1);
    expect(issues[0]).to.include({
      type: "MissingCustomFieldReference",
      missingItem: "Account.Legacy__c",
      referencingFile: "objects/Account/compactLayouts/Account.compactLayout-meta.xml"
    });
  });

  it("detects validation rule references to removed custom fields", () => {
    const removedItems: RemovedMetadataItem[] = [
      {
        type: "CustomField",
        name: "Account.Legacy__c",
        referenceKey: "Account.Legacy__c",
        sourceFile: "force-app/main/default/objects/Account/fields/Legacy__c.field-meta.xml"
      }
    ];
    const index = buildRemovedMetadataIndex(removedItems);
    const content = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
            <validationRules>
                <fullName>Prevent_Legacy__c</fullName>
                <errorConditionFormula>NOT(ISBLANK(Legacy__c))</errorConditionFormula>
            </validationRules>
        </CustomObject>`;

    const issues = findCustomFieldIssuesInContent(
      content,
      "objects/Account.object-meta.xml",
      index,
      "Validation Rule",
      "Account"
    );
    expect(issues).to.have.lengthOf(1);
    expect(issues[0]).to.include({
      type: "MissingCustomFieldReference",
      missingItem: "Account.Legacy__c",
      referencingFile: "objects/Account.object-meta.xml"
    });
  });

  it("detects record type references to removed custom fields", () => {
    const removedItems: RemovedMetadataItem[] = [
      {
        type: "CustomField",
        name: "Account.Legacy__c",
        referenceKey: "Account.Legacy__c",
        sourceFile: "force-app/main/default/objects/Account/fields/Legacy__c.field-meta.xml"
      }
    ];
    const index = buildRemovedMetadataIndex(removedItems);
    const content = `<?xml version="1.0" encoding="UTF-8"?>
        <RecordType xmlns="http://soap.sforce.com/2006/04/metadata">
            <picklistValues>
                <picklist>Legacy__c</picklist>
            </picklistValues>
        </RecordType>`;

    const issues = findCustomFieldIssuesInContent(
      content,
      "objects/Account/recordTypes/Consumer.recordType-meta.xml",
      index,
      "Record Type",
      "Account"
    );
    expect(issues).to.have.lengthOf(1);
    expect(issues[0]).to.include({
      type: "MissingCustomFieldReference",
      missingItem: "Account.Legacy__c",
      referencingFile: "objects/Account/recordTypes/Consumer.recordType-meta.xml"
    });
  });

  it("ignores files when no removed Apex classes are present", () => {
    const removedItems: RemovedMetadataItem[] = [];
    const index = buildRemovedMetadataIndex(removedItems);
    const issues = findIntegrityIssuesInSource("System.debug('Hello');", "classes/Example.cls", index);
    expect(issues).to.have.lengthOf(0);
  });
});
