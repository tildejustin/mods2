import JSZip from "jszip"

// TODO error handling, more 400 responses / reply with mods that are missing as well
export default {
    async fetch(request, env, ctx) {
        const { searchParams, origin } = new URL(request.url)
        if (!origin.endsWith("tildejustin.dev") && !origin.endsWith("minecraftspeedrunning.com")) {
            origin == undefined
        }
        const version = searchParams.get("version")
        const mods = searchParams.getAll("mod")
        if (version == undefined || mods.length == 0) {
            return new Response("Invalid query", { status: 400 })
        }
        let urls
        try {
            urls = (await getMods(version, mods)).map(it => it.url)
        } catch (e) {
            return new Response("Unable to access MCSR metadata", { status: 503 })
        }
        const allMods = await Promise.all(urls.map(it => fetch(it).then(async response => {
            if (!response.ok) {
                throw new Error("http error, status: " + response.status)
            }
            const filename = it.substring(Math.max(it.lastIndexOf("/"), it.lastIndexOf("=")) + 1)
            return { filename: filename, data: await response.bytes() }
        })))
        const zip = new JSZip()
        for (const modInfo of allMods) {
            zip.file(modInfo.filename, modInfo.data)
        }
        const headers = {
            "Content-Type": "application/x-modrinth-modpack+zip",
            "Content-Disposition": "attachment; filename=mods.zip",
            Vary: "Origin",
        }
        if (origin != undefined) {
            headers["Access-Control-Allow-Origin"] = origin
        }
        const blob = await zip.generateAsync({ type: "blob" })
        return new Response(blob, {
            message: "",
            headers: headers
        })
    }
}

async function getMods(version, mods) {
    return Promise.all([
        fetch("https://raw.githubusercontent.com/tildejustin/mcsr-meta/schema-7/mods.json"),
        fetch("https://raw.githubusercontent.com/tildejustin/mcsr-meta/schema-7/extra.json")
    ].map(promise => promise.then(response => {
        if (!response.ok) {
            throw new Error("http error, status: " + response.status)
        }
        return response.json()
    }))).then(([legal, other]) => {
        const modVersions = []
        legal.mods.push(other.mods.find(it => it.modid == "mcsrranked"))
        for (const mod of legal.mods) {
            if (!mods.includes(mod.modid)) continue
            const modVersion = mod.versions.find(it => it.target_version.includes(version))
            if (modVersion == undefined) continue
            modVersions.push(modVersion)
        }
        return modVersions
    })
}
