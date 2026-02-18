import { Readable } from "node:stream";
import { beforeEach, describe, expect, it } from "vitest";
import XmlParser from "./XmlParser.js";

const xml = (content: string) =>
  Buffer.from(`<?xml version="1.0" encoding="utf-8"?>${content}`);

describe("XmlParser", () => {
  let parser: XmlParser;

  beforeEach(() => {
    parser = new XmlParser();
  });

  describe("parse", () => {
    it("should uppercase tag names", () => {
      const result = parser.parse(xml('<root><item val="1"/></root>'));

      expect(result.ROOT.ITEM.$val).toBe("1");
    });

    it("should prefix attributes with $", () => {
      const result = parser.parse(
        xml('<data><row id="42" name="test"/></data>'),
      );

      expect(result.DATA.ROW.$id).toBe("42");
      expect(result.DATA.ROW.$name).toBe("test");
    });

    it("should keep numbers as strings", () => {
      const result = parser.parse(
        xml('<data><row price="123.45" code="007"/></data>'),
      );

      expect(result.DATA.ROW.$price).toBe("123.45");
      expect(typeof result.DATA.ROW.$price).toBe("string");
      expect(result.DATA.ROW.$code).toBe("007");
    });

    it('should convert "null" attribute values to empty string', () => {
      const result = parser.parse(xml('<data><row val="null"/></data>'));

      expect(result.DATA.ROW.$val).toBe("");
    });

    it("should trim attribute values", () => {
      const result = parser.parse(xml('<data><row val="  hello  "/></data>'));

      expect(result.DATA.ROW.$val).toBe("hello");
    });

    it("should handle empty attribute values", () => {
      const result = parser.parse(xml('<data><row val=""/></data>'));

      expect(result.DATA.ROW.$val).toBe("");
    });

    it("should parse multiple rows into an array", () => {
      const result = parser.parse(
        xml('<data><row id="1"/><row id="2"/><row id="3"/></data>'),
      );

      expect(result.DATA.ROW).toHaveLength(3);
      expect(result.DATA.ROW[0].$id).toBe("1");
      expect(result.DATA.ROW[2].$id).toBe("3");
    });

    it("should handle nested elements alongside attributes", () => {
      const result = parser.parse(
        xml('<data><item name="parent"><child val="nested"/></item></data>'),
      );

      expect(result.DATA.ITEM.$name).toBe("parent");
      expect(result.DATA.ITEM.CHILD.$val).toBe("nested");
    });

    it("should collapse &nbsp; and multiple spaces to single space", () => {
      const result = parser.parse(
        xml('<data><row val="hello&nbsp;&nbsp;world"/></data>'),
      );

      expect(result.DATA.ROW.$val).toBe("hello world");
    });

    it("should replace tabs, carriage returns and newlines with space", () => {
      const result = parser.parse(
        xml('<data><row val="line1\tline2\nline3\rline4"/></data>'),
      );

      expect(result.DATA.ROW.$val).toBe("line1 line2 line3 line4");
    });

    it("should strip invisible unicode characters", () => {
      const result = parser.parse(
        xml(
          '<data><row val="clean\u0002\u0003\u200B\u202A\u202Btext"/></data>',
        ),
      );

      expect(result.DATA.ROW.$val).toBe("cleantext");
    });

    it("should return single element as object, not array (fast-xml-parser quirk, consumers must handle both)", () => {
      const result = parser.parse(xml('<data><row id="only"/></data>'));

      expect(result.DATA.ROW.$id).toBe("only");
      expect(Array.isArray(result.DATA.ROW)).toBe(false);
    });

    it("should escape ><< in malformed XML", () => {
      const buf = Buffer.from('<data><item val="a"/><<item val="b"/></data>');
      const result = parser.parse(buf);

      expect(result.DATA.ITEM).toHaveLength(2);
      expect(result.DATA.ITEM[0].$val).toBe("a");
      expect(result.DATA.ITEM[1].$val).toBe("b");
    });

    it("should escape >&< in malformed XML", () => {
      const buf = Buffer.from('<data><item val="a"/>&<item val="b"/></data>');
      const result = parser.parse(buf);

      expect(result.DATA.ITEM).toHaveLength(2);
      expect(result.DATA.ITEM[0].$val).toBe("a");
      expect(result.DATA.ITEM[1].$val).toBe("b");
    });
  });

  describe("alwaysArray option", () => {
    let arrayParser: XmlParser;

    beforeEach(() => {
      arrayParser = new XmlParser({ alwaysArray: true });
    });

    it("should wrap single child element in array", () => {
      const result = arrayParser.parse(xml('<data><row id="only"/></data>'));

      expect(Array.isArray(result.DATA.ROW)).toBe(true);
      expect(result.DATA.ROW).toHaveLength(1);
      expect(result.DATA.ROW[0]!.$id).toBe("only");
    });

    it("should keep multiple elements as array", () => {
      const result = arrayParser.parse(
        xml('<data><row id="1"/><row id="2"/></data>'),
      );

      expect(Array.isArray(result.DATA.ROW)).toBe(true);
      expect(result.DATA.ROW).toHaveLength(2);
    });

    it("should not wrap root element in array", () => {
      const result = arrayParser.parse(xml('<data><row id="1"/></data>'));

      expect(Array.isArray(result.DATA)).toBe(false);
    });

    it("should not wrap attribute values in array", () => {
      const result = arrayParser.parse(xml('<data><row id="42"/></data>'));

      expect(result.DATA.ROW[0]!.$id).toBe("42");
      expect(Array.isArray(result.DATA.ROW[0]!.$id)).toBe(false);
    });

    it("should wrap nested children in arrays", () => {
      const result = arrayParser.parse(
        xml('<data><item name="p"><child val="n"/></item></data>'),
      );

      expect(Array.isArray(result.DATA.ITEM)).toBe(true);
      expect(Array.isArray(result.DATA.ITEM[0]!.CHILD)).toBe(true);
      expect(result.DATA.ITEM[0]!.CHILD[0]!.$val).toBe("n");
    });
  });

  describe("createParseReadStream", () => {
    it("should stream-parse rows by tag name", async () => {
      const content =
        '<data><item id="1" name="a"/><item id="2" name="b"/><item id="3" name="c"/></data>';
      const stream = Readable.from(Buffer.from(content));
      const xmlStream = parser.createParseReadStream(stream, "item");

      const collected: Record<string, string>[] = [];

      await new Promise<void>((resolve) => {
        xmlStream.on("data", (data: Record<string, string>[] | null) => {
          if (data) {
            collected.push(...data);
          }

          return Promise.resolve();
        });

        stream.on("end", () => setTimeout(resolve, 50));
      });

      expect(collected).toHaveLength(3);
      expect(collected[0]!.$id).toBe("1");
      expect(collected[2]!.$name).toBe("c");
    });

    it("should emit null when chunk has no matching tags", async () => {
      const stream = Readable.from(
        Buffer.from('<data><other val="x"/></data>'),
      );
      const xmlStream = parser.createParseReadStream(stream, "item");

      const emissions: Array<Record<string, string>[] | null> = [];

      await new Promise<void>((resolve) => {
        xmlStream.on("data", (data: Record<string, string>[] | null) => {
          emissions.push(data);

          return Promise.resolve();
        });

        stream.on("end", () => setTimeout(resolve, 50));
      });

      expect(emissions).toContain(null);
    });

    it("should wrap single row in array", async () => {
      const stream = Readable.from(
        Buffer.from('<data><item id="solo"/></data>'),
      );
      const xmlStream = parser.createParseReadStream(stream, "item");

      const collected: Record<string, string>[] = [];

      await new Promise<void>((resolve) => {
        xmlStream.on("data", (data: Record<string, string>[] | null) => {
          if (data) {
            collected.push(...data);
          }

          return Promise.resolve();
        });

        stream.on("end", () => setTimeout(resolve, 50));
      });

      expect(collected).toHaveLength(1);
      expect(collected[0]!.$id).toBe("solo");
    });

    it("should apply prepareFileContent escaping in stream", async () => {
      const content = '<data><item id="a"/><<item id="b"/></data>';
      const stream = Readable.from(Buffer.from(content));
      const xmlStream = parser.createParseReadStream(stream, "item");

      const collected: Record<string, string>[] = [];

      await new Promise<void>((resolve) => {
        xmlStream.on("data", (data: Record<string, string>[] | null) => {
          if (data) {
            collected.push(...data);
          }

          return Promise.resolve();
        });

        stream.on("end", () => setTimeout(resolve, 50));
      });

      expect(collected).toHaveLength(2);
      expect(collected[0]!.$id).toBe("a");
      expect(collected[1]!.$id).toBe("b");
    });
  });
});
