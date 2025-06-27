class AnswerEditor extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        const styleLink = document.createElement('link');
        styleLink.rel = 'stylesheet';
        styleLink.href = '/css/default.css';

        this.shadowRoot.innerHTML = `
      <style>
        .answer {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 0.5rem;
          border: 1px solid #ccc;
          border-radius: 8px;
          margin-bottom: 1rem;
          position: relative;
        }

        .preview img {
          max-width: 150px;
          max-height: 100px;
          display: block;
          margin-top: 0.5rem;
          border-radius: 4px;
        }
      </style>

      <div class="answer">
        <button class="remove-btn" title="Remove Answer">X</button>
        <input type="text" class="answer-text" placeholder="Entrez une reponse" />
        <input type="file" class="answer-image" accept="image/*" />
        <div class="preview"></div>
      </div>
    `;
        this.shadowRoot.prepend(styleLink);
    }

    connectedCallback() {
        this.textInput = this.shadowRoot.querySelector('.answer-text');
        this.imageInput = this.shadowRoot.querySelector('.answer-image');
        this.previewContainer = this.shadowRoot.querySelector('.preview');

        this.imageInput.addEventListener('change', () => this.handleImagePreview());

        this.shadowRoot.querySelector('.remove-btn').addEventListener('click', () => {
            this.remove();
        });
    }
    /**
       * Load answer data
       * @param {{ text: string, imageUrl?: string }} data 
       */
    setData(data) {
        this.textInput.value = data.intitule || '';
        this.previewContainer.innerHTML = '';

        if (data.url_image) {
            const img = document.createElement('img');
            img.src = data.url_image;
            this.previewContainer.appendChild(img);
        }
    }

    /**
     * Return current data for saving
     */
    getData() {
        return {
            text: this.textInput.value,
            imageFile: this.imageInput.files[0] || null
        };
    }

    /**
     * Show preview for newly selected image
     */
    handleImagePreview() {
        const file = this.imageInput.files[0];
        this.previewContainer.innerHTML = '';
        if (file) {
            const reader = new FileReader();
            reader.onload = e => {
                const img = document.createElement('img');
                img.src = e.target.result;
                this.previewContainer.appendChild(img);
            };
            reader.readAsDataURL(file);
        }
    }
}

customElements.define('answer-editor', AnswerEditor);