import AdmZip from "adm-zip";
import { beforeEach, describe, expect, it } from "vitest";
import XmlZipParser from "./XmlZipParser.js";

const createZipBuffer = (files: Array<{ name: string; content: string }>) => {
  const zip = new AdmZip();

  for (const file of files) {
    zip.addFile(file.name, Buffer.from(file.content));
  }

  return zip.toBuffer();
};

describe("XmlZipParser", () => {
  let parser: XmlZipParser;

  beforeEach(() => {
    parser = new XmlZipParser();
  });

  describe("parseFromZip", () => {
    it("should parse XML files from a zip buffer", () => {
      const zipBuffer = createZipBuffer([
        {
          name: "data.xml",
          content: '<root><row id="1"/><row id="2"/></root>',
        },
      ]);

      const result = parser.parseFromZip(zipBuffer);

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe("data.xml");
      expect(result[0]!.parsedData.ROOT.ROW).toHaveLength(2);
      expect(result[0]!.parsedData.ROOT.ROW[0].$id).toBe("1");
    });

    it("should parse multiple XML files from zip", () => {
      const zipBuffer = createZipBuffer([
        { name: "a.xml", content: '<data><item val="A"/></data>' },
        { name: "b.xml", content: '<data><item val="B"/></data>' },
      ]);

      const result = parser.parseFromZip(zipBuffer);

      expect(result).toHaveLength(2);
      expect(result[0]!.parsedData.DATA.ITEM.$val).toBe("A");
      expect(result[1]!.parsedData.DATA.ITEM.$val).toBe("B");
    });

    it("should skip non-XML files in zip", () => {
      const zipBuffer = createZipBuffer([
        { name: "data.xml", content: '<data><item val="keep"/></data>' },
        { name: "readme.txt", content: "ignore me" },
        { name: "photo.jpg", content: "binary stuff" },
      ]);

      const result = parser.parseFromZip(zipBuffer);

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe("data.xml");
    });

    it("should handle XML files in subdirectories", () => {
      const zipBuffer = createZipBuffer([
        {
          name: "subdir/nested.xml",
          content: '<data><item val="deep"/></data>',
        },
      ]);

      const result = parser.parseFromZip(zipBuffer);

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe("nested.xml");
      expect(result[0]!.parsedData.DATA.ITEM.$val).toBe("deep");
    });

    it("should return empty array for zip with no XML files", () => {
      const zipBuffer = createZipBuffer([
        { name: "data.json", content: '{"key": "value"}' },
      ]);

      const result = parser.parseFromZip(zipBuffer);

      expect(result).toHaveLength(0);
    });
  });

  describe("parseFromZip with alwaysArray", () => {
    let arrayParser: XmlZipParser;

    beforeEach(() => {
      arrayParser = new XmlZipParser({ alwaysArray: true });
    });

    it("should wrap single child element in array", () => {
      const zipBuffer = createZipBuffer([
        { name: "data.xml", content: '<root><row id="only"/></root>' },
      ]);

      const result = arrayParser.parseFromZip(zipBuffer);

      expect(result).toHaveLength(1);
      expect(Array.isArray(result[0]!.parsedData.ROOT.ROW)).toBe(true);
      expect(result[0]!.parsedData.ROOT.ROW).toHaveLength(1);
      expect(result[0]!.parsedData.ROOT.ROW[0].$id).toBe("only");
    });

    it("should keep multiple elements as array", () => {
      const zipBuffer = createZipBuffer([
        {
          name: "data.xml",
          content: '<root><row id="1"/><row id="2"/></root>',
        },
      ]);

      const result = arrayParser.parseFromZip(zipBuffer);

      expect(Array.isArray(result[0]!.parsedData.ROOT.ROW)).toBe(true);
      expect(result[0]!.parsedData.ROOT.ROW).toHaveLength(2);
    });
  });
});
