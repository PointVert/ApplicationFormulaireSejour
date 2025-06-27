class LayoutComponent extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          height: 100vh;
          font-family: sans-serif;
        }

        header {
          background-color: #4CAF50;
          color: white;
          padding: 1rem;
          width: 100wv;
          text-align: center;
        }

        .layout {
          flex: 1;
          display: flex;
          overflow: hidden;
        }

        nav a {
          margin-right: 5%;
        }

        #nav_form {
          width: 250px;
          background-color: #f4f4f4;
          padding: 1rem;
          box-sizing: border-box;
          border-right: 1px solid #ccc;
          overflow-y: auto;
        }

        section {
          flex: 1;
          padding: 1rem;
          overflow-y: auto;
        }

        ::slotted(nav) {
          width: 100%;
        }

        ::slotted(section) {
          width: 100%;
        }
      </style>

      <header>
        <slot name="header"></slot>
      </header>

      <div class="layout">
        <nav id="nav_form">
          <slot name="navbar"></slot>
        </nav>
        <section>
          <slot name="content"></slot>
        </section>
      </div>
    `;
    }
}

document.querySelector('form-navbar')?.addEventListener('form-selected', async (e) => {
    const formId = e.detail.identifiant_formulaire;
    const form = await fetch(`/api/forms/${formId}`).then(res => res.json());
    form.titre = e.detail.titre;
    document.querySelector('form-builder').setData(form);
});

customElements.define('layout-component', LayoutComponent);