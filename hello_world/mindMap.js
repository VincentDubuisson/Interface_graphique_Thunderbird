import MindElixir from './node_modules/mind-elixir/dist/MindElixir.js';
import nodeMenu from './node_modules/@mind-elixir/node-menu-neo/dist/node-menu-neo.js';

function loadCSS(url) {
    let link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    document.head.appendChild(link);
}

loadCSS("node_modules/@mind-elixir/node-menu/dist/style.css");


document.addEventListener("DOMContentLoaded", function() {
    let mind = new MindElixir({
        el: "#map",
        direction: MindElixir.SIDE,
        draggable: true,
        contextMenu: true,
        toolBar: true,
        nodeMenu: true,
        keypress: true,
        mainLinkStyle: 2, // [1,2] default 1
        mouseSelectionButton: 0, // 0 for left button, 2 for right button, default 0
        contextMenuOption: {
            focus: true,
            link: true,
            extend: [
            {
                name: 'Node edit',
                onclick: () => {
                alert('extend menu')
                },
            },
            ],
        },
    });

    const data = MindElixir.new("Nouvelle idée");
    mind.install(nodeMenu);
    mind.init(data);
});
