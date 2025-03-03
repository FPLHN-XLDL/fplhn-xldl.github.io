// SQL Playground page

import gister from "./cloud.js";
import locator from "./locator.js";
import manager from "./sqlite/manager.js";
import storage from "./storage.js";
import timeit from "./timeit.js";

import { actionButton } from "./components/action-button.js";
import { ActionController } from "./controllers/actions.js";
import { ShortcutController } from "./controllers/shortcuts.js";
import { DatabasePath } from "./db-path.js";
import { DEFAULT_NAME, MESSAGES, QUERIES } from "./sqlite/db.js";

const ui = {
    buttons: {
        execute: document.querySelector("#execute"),
        showTables: document.querySelector("#show-tables"),
    },
    name: document.querySelector("#db-name"),
    toolbar: document.querySelector("#toolbar"),
    commandbar: document.querySelector("#commandbar"),
    editor: document.querySelector("#editor"),
    status: document.querySelector("#status"),
    result: document.querySelector("#result"),
};

const actions = {
    executeCurrent: executeCurrent,
    loadDemo: loadDemo,
    showTables: showTables,
    showTable: showTable,
    visit: visit,
};

const shortcuts = {
    o: () => {
        ui.toolbar.btnOpenFile.click();
    },
    u: openUrl,
    "/": showTables,
};

let database;

// for testing purposes
window.app = {
    actions: actions,
    gister: gister,
    ui: ui,
};

// startFromCurrentUrl loads existing database or creates a new one
// using current window location as database path
async function startFromCurrentUrl() {
    const path = locator.path();
    const name = path.extractName();
    const success = await start(name, path);
    if (!success) {
        return;
    }
    showStarted();
}

// startFromUrl loads existing database
// from specified url
async function startFromUrl(url) {
    const path = new DatabasePath(url);
    const name = path.extractName();
    const success = await start(name, path);
    if (!success) {
        return;
    }
    history.pushState(database.name, null, `#${database.path.value}`);
    showStarted();
}

// startFromFile loads existing database
// from binary or sql file
async function startFromFile(file, contents, fileType) {
    const path = new DatabasePath(contents, fileType);
    const name = file.name;
    const success = await start(name, path);
    if (!success) {
        return;
    }
    history.pushState(database.name, null, "./");
    showStarted();
}

// start loads existing database or creates a new one
// using specified database path
async function start(name, path) {
    ui.result.clear();
    ui.status.info(MESSAGES.loading);

    try {
        const loadedDatabase = await manager.init(gister, name, path);
        console.debug(loadedDatabase);
        database = loadedDatabase;
        if (!loadedDatabase) {
            ui.status.error(`Failed to load database from ${path}`);
            return false;
        }
    } catch (exc) {
        ui.status.error(`Failed to load database from ${path}: ${exc}`);
        return false;
    }

    database.query = database.query || storage.get(database.name);

    document.title = database.meaningfulName || document.title;
    ui.name.ready(database.name);
    ui.status.info(MESSAGES.invite);
    ui.editor.value = database.query;
    ui.editor.focus();

    return true;
}

// executeCurrent runs the current SQL query
function executeCurrent() {
    return execute(ui.editor.query);
}

// execute runs SQL query on the database
// and shows results
function execute(sql) {
    sql = sql.trim();
    storage.set(database.name, sql);
    if (!sql) {
        ui.status.info(MESSAGES.invite);
        ui.result.clear();
        return Promise.resolve();
    }
    try {
        ui.status.fadeOut();
        ui.status.info(MESSAGES.executing);
        timeit.start();
        const result = database.execute(sql);
        const elapsed = timeit.finish();
        showResult(result, elapsed);
        return Promise.resolve();
    } catch (exc) {
        showError(exc);
        return Promise.reject(exc);
    } finally {
        ui.status.fadeIn();
    }
}

// openUrl loads database from local or remote url
function openUrl() {
    const url = prompt("Enter database file URL:", "https://path/to/database");
    if (!url) {
        return;
    }
    startFromUrl(url);
}

// changeName changes database name
function changeName(name) {
    if (name == ui.name.value && name == database.name) {
        return;
    }
    storage.remove(database.name);
    database.name = name;
    storage.set(name, database.query);
    ui.name.value = name;
    document.title = name;
}

// showStarted shows the result of successful database load
function showStarted() {
    if (database.query) {
        execute(database.query);
        enableCommandBar();
    } else if (database.tables.length) {
        showTableContent(database.tables[0]);
        enableCommandBar();
    } else {
        showWelcome();
    }
}

// showTables shows all database tables
function showTables() {
    const tables = database.gatherTables();
    if (!tables.length) {
        ui.status.info("Database is empty");
        return Promise.reject();
    }
    ui.status.info(`${tables.length} tables:`);
    ui.result.printTables(tables);
    return Promise.resolve();
}

// showTable shows specific database table
function showTable(table) {
    const result = database.getTableInfo(table);
    const all = actionButton("showTables", "tables");
    ui.status.info(`${all} / ${table}:`);
    ui.result.print(result);
    return Promise.resolve();
}

// showTableContent select data from specified table
function showTableContent(table) {
    const query = QUERIES.tableContent.replace("{}", table);
    ui.editor.value = query;
    execute(query);
}

// loadDemo loads demo database
function loadDemo() {
    window.location.assign(DEMO_URL);
    return Promise.resolve();
}

// showWelcome show the welcome message
function showWelcome() {
    const message = ''
    ui.status.info(message);
}

// showResult shows results and timing
// of the SQL query execution
function showResult(result, elapsed) {
    if (result && result.values.length) {
        ui.status.success(`${result.values.length} rows, took ${elapsed} ms`);
        ui.result.print(result);
    } else {
        ui.status.success(`0 rows, took ${elapsed} ms`);
        ui.result.print("");
    }
}

// showError shows an error occured
// during SQL query execution
function showError(exc) {
    const err = exc.toString().split("\n")[0];
    ui.result.clear();
    ui.status.error(err);
}

// enableCommandBar enables all buttons
// in the command bar
function enableCommandBar() {
    ui.commandbar.classList.remove("sqlime-disabled");
}

function visit(page) {
    window.location.assign(`${page}.html`);
    return Promise.resolve();
}

// User changed database name
ui.name.addEventListener("change", (event) => {
    changeName(event.target.value);
});

// Toolbar 'open file' button click
ui.toolbar.addEventListener("open-file", (event) => {
    const file = event.detail;
    const reader = new FileReader();
    const fileType = file.name.endsWith(".sql") ? "sql" : "binary";
    reader.onload = function () {
        event.target.value = "";
        startFromFile(file, reader.result, fileType);
    };
    if (fileType == "sql") {
        reader.readAsText(file);
    } else {
        reader.readAsArrayBuffer(file);
    }
});

// Toolbar 'open url' button click
ui.toolbar.addEventListener("open-url", () => {
    openUrl();
});

// Navigate back to previous database
window.addEventListener("popstate", () => {
    startFromCurrentUrl();
});

// SQL editor 'execute' event
ui.editor.addEventListener("execute", (event) => {
    execute(event.detail);
});

// SQL editor 'started typing' event
ui.editor.addEventListener("start", (event) => {
    enableCommandBar();
});

// Handle user actions
new ActionController(actions).listen(ui.commandbar, ui.status, ui.result);
new ShortcutController(shortcuts).listen(document);

gister.loadCredentials();
startFromCurrentUrl();
