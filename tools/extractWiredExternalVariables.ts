import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const regex = /win_error=[^\n]+([^\t]+wiredfurni\.view_in_menu=[^\n]+)/;

function removeHtmlTags(str: string): string {
  return str.replace(/<[^>]*>/g, "");
}

async function convertTxtResultToJson(
  url: string,
  folderToSave: string,
): Promise<void> {
  const response = await fetch(url);
  const data = await response.text();

  const match = data.match(regex);
  if (!match || match.length < 2) {
    console.log("No external variables found");
    return;
  }

  const externalVariablesContent = match[1].trim();
  const lines = externalVariablesContent.split("\n");
  const jsonResult: Record<string, any> = {};

  const processLine = (line: string) => {
    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) return;

    const rawKey = line.substring(0, eqIndex).trim();
    let value = line.substring(eqIndex + 1).trim();
    if (!rawKey || !value) return;

    let keys = rawKey.split(".");
    if (keys[0] === "wiredfurni") {
      keys = keys.slice(1);
    }

    value = removeHtmlTags(value).replace(/%(\w+)%/g, "{{$1}}");

    keys.reduce((current, key, idx) => {
      if (idx === keys.length - 1) {
        if (typeof current[key] === "object" && current[key] !== null) {
          current[key].title = value;
          return current;
        }

        if (value.includes('${')) {
          const referencedKey = value.replace('${', '').replace('}', '');
          const matchValue = data.match(new RegExp(`^${referencedKey}=([^\n]+)$`, "m"));
          if (matchValue) {
            const parts = matchValue[0].split("=");
            if (parts[0] && parts[1]) {
              current[key] = parts[1].trim();
              return current;
            }
          }
        }

        current[key] = value;
        return current;
      }

      if (!current[key] || typeof current[key] !== "object") {
        current[key] = {};
      }
      return current[key];
    }, jsonResult);
  };

  lines.forEach(processLine);

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const folderPath = path.join(__dirname, "..", "locales", folderToSave);
  await fs.mkdir(folderPath, { recursive: true });

  const filePath = path.join(folderPath, "wired_params.json");
  await fs.writeFile(filePath, JSON.stringify(jsonResult, null, 2));
}


(async () => {
  const countries = ["br", "de", "en", "es", "fi", "fr", "it", "nl", "tr"];
  await Promise.all(
    countries.map(async (country) => {
      let updatedCountry = country;

      if (country === "en") {
        updatedCountry = "com";
      }

      if (country === "tr") {
        updatedCountry = "com.tr";
      }

      if (country === "br") {
        updatedCountry = "com.br";
      }

      const url = `https://www.habbo.${updatedCountry}/gamedata/external_flash_texts/0`;
      await convertTxtResultToJson(url, country);
    })
  );
})();
