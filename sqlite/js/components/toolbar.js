// Toolbar element
class Toolbar extends HTMLElement {
    connectedCallback() {
        if (!this.rendered) {
            this.render();
            this.listen();
            this.rendered = true;
        }
    }

    render() {
        this.innerHTML = `
<label title="⌃O or ⌘O" class="button button--small">
    open file <input type="file">
</label>
<button title="⌃U or ⌘U" class="button button--small">open url</button>
`;
        this.btnOpenFile = this.querySelector(":nth-child(1)");
        this.file = this.btnOpenFile.querySelector("input");
        this.btnOpenUrl = this.querySelector(":nth-child(2)");
    }

    listen() {
        this.file.addEventListener("change", (event) => {
            if (!event.target.files.length) {
                return;
            }
            const file = event.target.files[0];
            this.dispatchEvent(new CustomEvent("open-file", { detail: file }));
        });

        this.btnOpenUrl.addEventListener("click", (event) => {
            this.dispatchEvent(new Event("open-url"));
        });
    }
}

customElements.define("tool-bar", Toolbar);
