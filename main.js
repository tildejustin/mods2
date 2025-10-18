var multiSelect = false
var checkboxes = [];
var legalMods = null
var otherMods = null
var allMods = null
var versions = []
var currConfig = null
// var activeCheckbox = null

const Category = {
    RANDOM_SEED: "random_seed",
    SET_SEED: "set_seed"
}

var category = Category.RANDOM_SEED

specialVersions = {
    "15w14a": "1.8.3-",
    "1.RV-Pre1": "1.9.3-",
    "3D Shareware v1.34": "1.14-",
    "20w14infinite": "1.16-",
    "22w13oneblockatatime": "1.19-",
    "23w13a_or_b": "1.19.3-",
    "24w14potato": "1.20.5-",
    "25w14craftmine": "1.21.6-"
}

const topVersions = ["1.16.1", "1.15.2", "1.11.2", "1.8.9", "1.7.10", "1.16.5", "1.12.2", "1.8", "1.12", "20w14infinite"]

function setVersionOptions() {
    const datalist = document.querySelector("#versions")

    for (const mod of legalMods) {
        for (const version of mod.versions) {
            for (const target_version of version.target_version) {
                if (!versions.includes(target_version)) {
                    versions.push(target_version)
                }
            }
        }
    }

    versions.sort((a, b) => {
        // arbitrary semver
        if (a == b) return 0
        a = (specialVersions[a] ?? a).split(".")
        b = (specialVersions[b] ?? b).split(".")
        const max_len = Math.max(a.length, b.length)
        for (let i = 0; i < max_len; i++) {
            a_i = parseInt(a[i] ?? 0)
            b_i = parseInt(b[i] ?? 0)
            if (a_i != b_i) return b_i - a_i
        }
        a_pre = a.at(-1).split("-")[1]
        b_pre = b.at(-1).split("-")[1]
        if (a_pre == b_pre) return 0
        if (a_pre == undefined) return -1
        if (b_pre == undefined) return 1
        return b_pre.localeCompare(a_pre, "en_US")
    })

    versions = versions.filter(version => !topVersions.includes(version))
    versions.unshift(...topVersions)

    for (const version of versions) {
        let option = new Option()
        option.value = version
        datalist.appendChild(option)
    }
}

function filterMods(config) {
    const obsoletePredicate = mod => mod.obsolete || currVersionOf(mod, config.version).obsolete
    let legal = filterModsInner(legalMods, config, mod => !obsoletePredicate(mod))
    let other = filterModsInner(otherMods, config)
    let obsolete = filterModsInner(legalMods, config, mod => obsoletePredicate(mod))
    return [legal, other, obsolete]
}

function filterModsInner(mods, config, predicate = _ => true) {
    const res = []
    outer: for (const mod of mods) {
        for (const version of mod.versions) {
            if (version.target_version.includes(config.version) && checkRules(mod, config) && predicate(mod)) {
                res.push(mod)
                continue outer
            }
        }
    }
    return res
}

function checkRules(mod, config) {
    if (mod.traits == undefined) return true
    if (config.macos && mod.modid == "sodium" && currVersionOf("sodiummac", config.version) != null) return false
    if (mod.traits.includes("mac-only") && !config.macos) return false
    if (mod.traits.includes("ssg-only") && config.category != Category.SET_SEED) return false
    if (mod.traits.includes("rsg-only") && config.category != Category.RANDOM_SEED) return false
    return true
}

/**
 * 
 * @param {*} mod the mod to search
 * @param {*} version the minecraft version compatibility is requested for
 * @returns the modVersion that includes the target version, or null
 */
function currVersionOf(mod, version) {
    return mod.versions.find(modVersion => modVersion.target_version.includes(version))
}

function refreshMods(config) {
    currConfig = config
    disableMultiSelect()
    checkboxes = []

    const [currLegalMods, currOtherMods, obsoleteMods] = filterMods(config)
    const obsoleteModids = obsoleteMods.map(it => it.modid)

    const legalDiv = document.querySelector("#legal")
    legalDiv.replaceChildren()
    for (const mod of currLegalMods) {
        version = currVersionOf(mod, config.version)
        legalDiv.appendChild(createEntry(mod, version, true, obsoleteModids))
    }

    const otherDiv = document.querySelector("#other")
    otherDiv.replaceChildren()
    document.querySelectorAll(".other-text").forEach(it => it.hidden = currOtherMods.length == 0)
    for (const mod of currOtherMods) {
        const version = currVersionOf(mod, config.version)
        otherDiv.appendChild(createEntry(mod, version, mod.modid == "mcsrranked", obsoleteModids))
    }
}

function createEntry(mod, version, legal, obsoleteMods) {
    const details = document.createElement("details")
    details.classList.add("mod-entry")
    const summary = document.createElement("summary")
    if (legal) {
        summary.classList.add("legal-listing")
        // scope shenanigans
        var checkbox = document.createElement("input")
        checkbox.type = "checkbox"
        checkbox.classList.add("ms-checkbox", "hidden")
        checkbox.id = "ms-checkbox-" + mod.modid
        label = document.createElement("label")
        label.classList.add("hidden", "ms-checkbox-label")
        label.htmlFor = checkbox.id
    }
    const modName = document.createElement("span")
    modName.classList.add("name-align")
    const versionSpan = document.createElement("span")
    versionSpan.title = "ID: " + mod.modid
    const description = document.createElement("p")
    const download = document.createElement("a")
    download.href = version.url
    download.classList.add("button")
    download.setAttribute("download", "")
    download.textContent = "[Download]"
    const homepage = document.createElement("a")
    homepage.href = mod.homepage;
    homepage.textContent = "[Homepage]";
    if (mod.homepage.includes("frontcage.com")) homepage.textContent = "[Frontcage]";
    else if (mod.homepage.includes("github.com")) homepage.textContent = "[GitHub]";
    else if (mod.homepage.includes("modrinth.com")) homepage.textContent = "[Modrinth]";
    summary.addEventListener("click", summaryOnClick)
    description.prepend(document.createElement("br"), download, document.createTextNode(" "), homepage)
    incompatibilityText = handleIncompatibilities(mod, obsoleteMods)
    if (incompatibilityText) {
        description.prepend(document.createElement("br"), document.createTextNode(incompatibilityText))
    }
    description.prepend(document.createTextNode(mod.description))
    modName.prepend(document.createTextNode(mod.name))
    versionSpan.prepend(document.createTextNode("v" + version.version))
    summary.prepend(modName, versionSpan)
    if (legal) summary.prepend(checkbox, label)
    details.prepend(summary, description)

    if (legal) checkboxes.push(checkbox)
    return details
}

function handleIncompatibilities(mod, obsoleteMods) {
    if (!mod.incompatibilities) return false
    const incompatibilities = mod.incompatibilities
        .filter(it => !obsoleteMods.includes(it))
        .map(id => allMods.find(mod => mod.modid == id).name)
    return incompatibilities.length == 0 ? false : "Incompatible with: " + incompatibilities.join(", ")
}

function summaryOnClick(e) {
    let target = e.target
    while (target.tagName != "SUMMARY") target = target.parentElement
    if (!target.classList.contains("legal-listing")) return

    if (!multiSelect) {
        // regular dropdown interaction
        if (!e.ctrlKey) return

        // ctrl key pressed, turn on multiselect and check the element clicked on
        e.preventDefault()
        enableMultiSelect()
        // reclick to make the actual selection after the checkbox is created
        this.click()
        return
    }

    // disable dropdown
    e.preventDefault()

    const checkbox = target.querySelector("input");
    checkbox.checked = !checkbox.checked;

    if (checkboxes.every(it => !it.checked)) {
        disableMultiSelect()
    }

    /* file explorer behavior: kinda cool but regular people have to be able to use this site unfortunately

    // no ctrl -> don't preserve current selections
    // act as if ctrl is pressed for keyboard. I may just make that default behavior
    if (!e.ctrlKey == e.detail != 0) checkboxes.forEach(it => it.checked = false)
    // every type of click selects the current entry
    checkbox.checked = !checkbox.checked;
    // no shift -> overrite curr
    if (!e.shiftKey) {
        activeCheckbox = checkbox
        // if shift, go from "active" (last no shift press) to press
    } else {
        if (activeCheckbox == null) throw Error("activeCheckbox is null")
        start = checkboxes.indexOf(activeCheckbox)
        end = checkboxes.indexOf(checkbox)
        // already done at the start
        if (start == end) return
        // go upwards if the click is above curr
        if (start > end) [start, end] = [end, start]
        for (let i = start; i <= end; i++) checkboxes[i].checked = true
    }

    // unfortunate side-effect of using shift is it starts selecting text
    if (window.getSelection) {
        let selection = window.getSelection();
        selection.removeAllRanges();
    }
    */

}

/**
 * Gets the config represented by the current state of the website
 * @returns null if version is invalid, else object with fields version, macos, 
 */
function getConfig() {
    const currVersion = document.querySelector("#version").value
    if (!versions.includes(currVersion)) return null
    return {
        version: currVersion,
        category: document.querySelector("input[name=category]:checked").id,
        macos: document.querySelector("#macos").checked
    }
}

document.addEventListener("DOMContentLoaded", () => {
    Promise.all([
        fetch("https://raw.githubusercontent.com/tildejustin/mcsr-meta/schema-7/mods.json"),
        fetch("https://raw.githubusercontent.com/tildejustin/mcsr-meta/schema-7/extra.json")
    ].map(promise => promise.then(response => {
        if (!response.ok) {
            // TODO: warn user
            throw new Error("http error, status: " + response.status)
        }
        return response.json()
    }))).then(([legal, other]) => {
        // TODO: decode url params
        legalMods = legal["mods"]
        otherMods = other["mods"]
        allMods = legalMods.concat(otherMods)
        const macos = navigator.userAgentData?.platform == "macOS"
        document.querySelector("#macos").checked = macos
        document.querySelector("#version").value = "1.16.1"
        // chrome doesn't autoselect a radio box
        document.querySelector("#random_seed").checked = true
        setVersionOptions()
        refreshMods(getConfig())
    })

    document.querySelector("#sel-recommended").addEventListener("click", () => {
        if (!multiSelect) enableMultiSelect()
        for (checkbox of checkboxes) {
            const modid = checkbox.id.substring("ms-checkbox-".length)
            const mod = legalMods.find(it => it.modid == modid)
            if (mod == undefined) continue // ranked has a checkbox
            const version = currVersionOf(mod, currConfig.version)
            const recommended = (mod["recommended"] ?? true) && (version["recommended"] ?? true)
            checkbox.checked = recommended
        }
    })

    // call the click event listener for a tags with no href
    document.querySelector(".button").addEventListener("keyup", function (e) {
        if (e.code == "Space" || e.code == "Enter") {
            e.target.click()
        }
    })

    document.querySelectorAll(".updates-list").forEach(it => it.addEventListener("change", function (e) {
        let config = getConfig()
        if (config != null) refreshMods(config)
    }))

    document.querySelector("#start-sel").addEventListener("click", () => enableMultiSelect())
    document.querySelector("#deselect-all").addEventListener("click", () => disableMultiSelect())

    document.querySelector("#modpack").addEventListener("click", function () {
        const config = getConfig()
        const versions = selectedVersions()
        if (versions.length == 0) alert("No mods selected!")
        fetch("https://meta.fabricmc.net/v2/versions/loader")
            .then(res => res.json())
            .then(data => generateModpack(config, data[0].version, versions))
    })
})

function selectedVersions() {
    return checkboxes.filter(it => it.checked).map(checkbox => {
        const modid = checkbox.id.substring("ms-checkbox-".length)
        // ranked can be selected
        const mod = allMods.find(it => it.modid == modid)
        return currVersionOf(mod, currConfig.version)
    })
}

function generateModpack(config, loader, versions) {
    const id = `${config.version}-${config.category}` + (config.macos ? "-macos" : "")
    const index = {
        formatVersion: 1,
        game: "minecraft",
        versionId: id,
        name: "MCSR Mods",
        dependencies: {
            "fabric-loader": loader,
            "minecraft": config.version
        },
        files: versions.map(it => {
            return {
                path: "mods/" + it.url.substring(Math.max(it.url.lastIndexOf("/"), it.url.lastIndexOf("=")) + 1),
                hashes: {
                    sha1: it.sha1,
                    sha512: it.sha512
                },
                downloads: [it.url],
                fileSize: it.fileSize
            }
        })
    }
    const zip = JSZip()
    zip.file("modrinth.index.json", JSON.stringify(index))
    zip.generateAsync({ type: "blob" })
        .then(it => {
            const blobUrl = URL.createObjectURL(it)
            const tempLink = document.createElement("a")
            tempLink.href = blobUrl
            tempLink.download = id + ".mrpack"
            tempLink.type = "application/x-modrinth-modpack+zip"
            tempLink.click()
            URL.revokeObjectURL(blobUrl)
        })
}

function enableMultiSelect() {
    document.querySelectorAll("summary.legal-listing").forEach(it => it.parentElement.open = false)
    // this doesn't do what it's supposed to but it removes the ::before element and that's good enough
    // I hate web development so much actually wtf is this behavior. it better be consistent.
    document.documentElement.style.setProperty("--symbol", "_")
    document.querySelectorAll(".ms-checkbox-label").forEach(it => it.classList.remove("hidden"))
    document.querySelectorAll(".ms-show").forEach(it => it.classList.remove("hidden"))
    document.querySelectorAll(".ms-hide").forEach(it => it.classList.add("hidden"))
    multiSelect = true
    // activeCheckbox = checkboxes[0]
}

function disableMultiSelect() {
    checkboxes.forEach(it => it.checked = false)
    document.documentElement.style.removeProperty("--symbol")
    document.querySelectorAll(".ms-checkbox-label").forEach(it => it.classList.add("hidden"))
    document.querySelectorAll(".ms-show").forEach(it => it.classList.add("hidden"))
    document.querySelectorAll(".ms-hide").forEach(it => it.classList.remove("hidden"))
    multiSelect = false
    // activeCheckbox = null
}
