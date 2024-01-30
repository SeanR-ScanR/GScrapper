const { parse } = require("node-html-parser");
const Canvas = require("@napi-rs/canvas");
const fs = require("fs");
const rl = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout,
});

rl._writeToOutput = function _writeToOutput(stringToWrite) {
    if (!rl.stdoutMuted) rl.output.write(stringToWrite);
    else rl.output.write("\x1B[2K\x1B[200DEntrez votre mot de passe : ");
};

let Cookie;
const series = {
  yamada: "yamadalv999",
};

const references = []

const path = "./series";

const numberFormat = new Intl.NumberFormat("fr-FR", {
  minimumIntegerDigits: 2,
});
const f = numberFormat.format;

const main = async (refChaps) => {
    if (!(await getGlobalCookie())) return;

    if (!fs.existsSync(path)) fs.mkdirSync(path);
    const allSeries = Object.entries(series);
    allSeries.forEach(async ([index,value]) => {
        const urlJSON = `https://ganma.jp/api/1.0/magazines/web/${value}`;
        const xFrom = `https://ganma.jp/${value}`;
        const json = await fetch(urlJSON,{headers:{"Cookie":Cookie,"x-from":xFrom,"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"}}).then(res => res.json());
        const items = json.root.items;
        if(!refChaps[0]) refChaps.push(json.root.publicLatestStoryNumber-1); 
        await Promise.all(refChaps.map(async refChap => {
            if(refChap >= json.root.publicLatestStoryNumber) return console.log(`Le chapitre ${refChap+1} de ${index} n'existe pas.`)
            const chap = items[refChap];
            const page = chap.page;
            const filesName = page.files;
            const baseUrl = (name) => `${page.baseUrl}${name}?${page.token}`;
            const urls = filesName.map(baseUrl);
            const folderSeries = `./${path}/${index}`
            if(!fs.existsSync(folderSeries)) fs.mkdirSync(folderSeries);
            const folder = `${folderSeries}/${refChap+1}`;
            if(fs.existsSync(folder)) return console.log(`${index} : ${refChap+1} déjà dl`);
            fs.mkdirSync(folder)
            const download = downloader(folder);
            await Promise.all(urls.map(download));
            console.log(`${index} ${refChap+1} end`);
        }))
    });
};

const getGlobalCookie = async () => {
    let cookieFile;
    let isExpire = false;
    let cookie;
    if (fs.existsSync("./cookie.json")) {
      cookieFile = fs.readFileSync("./cookie.json");
      try {
        const cookieJson = JSON.parse(cookieFile);
        new Date(cookieJson.expire);
        const expire = cookieJson.expire;
        if (new Date().getTime() >= expire) isExpire = true;
        else cookie = cookieJson;
      } catch {
        isExpire = true;
      }
    }
    let body = fs.readFileSync("./config.json");
    if (!cookieFile || isExpire) {
        try {
            const res = await fetch(
                "https://ganma.jp/api/3.0/session?mode=mail&clientType=browser&explicit=true",
                {
                    method: "POST",
                    headers: { 
                        "Content-Type": "application/json",  
                        "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
                        "x-from":"https://ganma.jp/_cd/login"
                    },
                    body: body,
                }
            ).then((res) => res);
            const cookieGlobal = res.headers
            .getSetCookie()
            .filter((e) => e.startsWith("PLAY_SESSION"))[0]
            .split("; ");
            const expire = new Date(cookieGlobal[1].slice(8)).getTime();
                cookie = {
                cookie: cookieGlobal[0],
                expire: expire,
            };
            fs.writeFileSync("./cookie.json", JSON.stringify(cookie));
        } catch (e) {
            console.log("Les informations de connection sont erronnés, veuillez recommencer");
            console.log(e);
            fs.rmSync("./config.json");
            return false;
        }
    } 
    Cookie = cookie.cookie;
    return true;
}

const downloader = (folder) => {
  return async (value, index) => {
    const image = await fetch(value).then((res) => res.arrayBuffer());
    fs.writeFileSync(`${folder}/${f(index + 1)}.jpg`, Buffer.from(image));
  };
};

rl.stdoutMuted = false;
if (!fs.existsSync("./config.json")) {
    rl.question("Entrez votre email : ", (email) => {
        rl.stdoutMuted = true;
        rl.question("Entrez votre mot de passe : ", (password) => {
            const config = { mail: email, password: password };
            fs.writeFileSync("./config.json", JSON.stringify(config));
            rl.stdoutMuted = false;
            rl.close()
            main(references.map(x=>x-1));
        });
    });
} else {
    main(references.map(x=>x-1));
}
