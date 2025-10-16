var multiSelect = false
var checkboxes = [];
var mods = null
var versions = []
// var activeCheckbox = null

const Category = {
    RANDOM_SEED: "rs",
    SET_SEED: "ss"
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
    datalist = document.querySelector("#versions")

    for (const mod of mods) {
        for (const version of mod.versions) {
            for (const target_version of version.target_version) {
                if (!versions.includes(target_version)) {
                    versions.push(target_version)
                }
            }
        }
    }

    versions.sort((a, b) => {
        // arbitrary semver, 
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
    res = []
    outer: for (const mod of mods) {
        for (const version of mod.versions) {
            if (version.target_version.includes(config.version) && checkRules(mod, config)) {
                res.push(mod)
                continue outer
            }
        }
    }
    return res
}

function checkRules(mod, config) {
    // TODO sodium mac
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
    disableMultiSelect()
    detailsDiv = document.querySelector(".mods")
    detailsDiv.replaceChildren()
    currMods = filterMods(config)
    for (const mod of currMods) {
        version = currVersionOf(mod, config.version)
        detailsDiv.appendChild(createEntry(mod, version))
    }
}

function createEntry(mod, version) {
    details = document.createElement("details")
    details.classList.add("mod-entry")
    summary = document.createElement("summary")
    // TODO: initial focus on first mod?
    summary.tabIndex = 1
    checkbox = document.createElement("input")
    checkbox.type = "checkbox"
    checkbox.classList.add("ms-checkbox", "hidden")
    checkbox.id = "ms-checkbox-" + mod.modid
    label = document.createElement("label")
    label.classList.add("hidden", "ms-checkbox-label")
    label.htmlFor = checkbox.id
    versionSpan = document.createElement("span")
    versionSpan.classList.add("version-align")
    description = document.createElement("p")
    download = document.createElement("a")
    download.href = version.url
    download.classList.add("button")
    download.setAttribute("download", "")
    download.textContent = "[Download]"
    wiki = document.createElement("a")
    // TODO: check
    wiki.href = "https://frontcage.com/t/" + mod.modid
    wiki.textContent = "[Wiki]"

    summary.addEventListener("click", summaryOnClick)

    description.prepend(document.createTextNode(mod.description), document.createElement("hr"), download, document.createTextNode(" "), wiki)
    versionSpan.prepend(document.createTextNode("v" + version.version))
    summary.prepend(checkbox, label, document.createTextNode(" " + mod.name), versionSpan)
    details.prepend(summary, description)

    checkboxes.push(checkbox)
    return details
}

function summaryOnClick(e) {
    if (!multiSelect) {
        // regular dropdown interaction
        if (!e.ctrlKey) {
            if (window.getSelection) {
                let selection = window.getSelection();
                selection.removeAllRanges();
            }
            return
        }

        // ctrl key pressed, turn on multiselect and check the element clicked on
        e.preventDefault()
        enableMultiSelect()
        // reclick to make the actual selection after the checkbox is created
        this.click()
        return
    }

    // disable dropdown
    e.preventDefault()

    const checkbox = e.target.tagName == "INPUT" ? e.target :
        (e.target.tagName == "LABEL" ? e.target.parentElement : e.target)
            .querySelector("input");
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
    let currVersion = document.querySelector("#version").value
    if (!versions.includes(currVersion)) return null
    return {
        version: currVersion,
        category: document.querySelector("input[name=category]:checked").id,
        macos: document.querySelector("#macos").checked
    }
}

document.addEventListener("DOMContentLoaded", () => {
    fetch("https://raw.githubusercontent.com/tildejustin/mcsr-meta/schema-6/mods.json")
        .then(response => {
            if (!response.ok) {
                // TODO: warn user
                throw new Error("http error, status: " + response.status)
            }
            return response.json()
        })
        .then(data => {
            // TODO: decode url params
            mods = data["mods"]
            macos = navigator.userAgentData?.platform == "macOS"
            document.querySelector("#macos").checked = macos
            document.querySelector("#version").value = "1.16.1"
            // chrome doesn't autoselect a radio box
            document.querySelector("#rs").checked = true
            setVersionOptions()
            refreshMods(getConfig())
        })

    // TODO: doesn't work with keyboard?
    document.querySelector("#sel-recommended").addEventListener("click", function () {
        if (!multiSelect) enableMultiSelect()
        // TODO proper recommendations
        // unrecommended = (mod["recommended"] ?? true) || (version["recommended"] ?? true)
        // map id -> checkbox + helper function isRecommended(mod)
        checkboxes.forEach(it => it.checked = true)
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

    // document.querySelector("") // other buttons
});

function enableMultiSelect() {
    document.querySelectorAll("details").forEach(it => it.open = false)
    // this doesn't do what it's supposed to but it removes the ::before element and that's good enough
    // I hate web development so much actually wtf is this behavior. it better be consistent.
    document.documentElement.style.setProperty("--symbol", "_")
    document.querySelectorAll(".ms-checkbox-label").forEach(it => it.classList.remove("hidden"))
    document.querySelectorAll(".ms-show").forEach(it => it.classList.remove("hidden"))
    multiSelect = true
    // activeCheckbox = checkboxes[0]
}

function disableMultiSelect() {
    checkboxes.forEach(it => it.checked = false)
    document.documentElement.style.removeProperty("--symbol")
    document.querySelectorAll(".ms-checkbox-label").forEach(it => it.classList.add("hidden"))
    document.querySelectorAll(".ms-show").forEach(it => it.classList.add("hidden"))
    multiSelect = false
    // activeCheckbox = null
}
