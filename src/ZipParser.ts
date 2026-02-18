import type { ReadStream } from "node:fs";
import { basename } from "node:path";
import AdmZip from "adm-zip";
import unzipper from "unzipper";

class ZipParser {
  public static async *createReadStreamsGetterFromEntries(data: ReadStream) {
    const zip = data.pipe(unzipper.Parse({ forceStream: true }));

    data.on("close", () => zip.end());

    for await (const entry of zip) {
      const typedEntry: unzipper.Entry = entry;
      const fileName = entry.path;

      yield {
        name: basename(fileName),
        stream: typedEntry,
      };
    }
  }

  public static getEntries(data: Buffer) {
    const zip = new AdmZip(data);

    const zipEntries = zip.getEntries();

    return zipEntries.map((entry) => {
      const entryData = entry.getData();

      return {
        name: entry.name,
        data: entryData,
      };
    });
  }
}

export default ZipParser;
