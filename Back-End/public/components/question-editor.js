class QuestionEditor extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.answerId = 0;
        const styleLink = document.createElement('link');
        styleLink.rel = 'stylesheet';
        styleLink.href = '/css/default.css';

        this.shadowRoot.innerHTML = `
            <style>
            .question { border: 1px dashed #aaa; padding: 1rem; margin-top: 1rem; }
            </style>
            <div class="question">
            <button class="remove-btn">X</button>
            <label>Question: <input type="text" class="label" id="question-text" /></label><br>
            <label>Type:
                <select class="type" id="question-type">
                <option value="text">Texte</option>
                <option value="radio">Choix unique</option>
                <option value="checkbox">Choix multiple</option>
                <option value="tableau_activite">Tableau d'activite</option>
                <option value="tableau_accompagnement">Tableau d'accompagnement</option>
                </select>
            </label>
            <div class="answers"></div>
            <button class="add-answer" style="display:none;">Ajouter une reponse</button>
            </div>
        `;
        this.shadowRoot.prepend(styleLink);
    }

    connectedCallback() {
        if (this._initialized) return;
            this._initialized = true;

        const typeSelector = this.shadowRoot.querySelector('.type');
        typeSelector.addEventListener('change', () => this.toggleAnswers());
    
        this.shadowRoot.querySelector('.add-answer')
            .addEventListener('click', () => this.addAnswer());

        this.shadowRoot.querySelector('.remove-btn')
                .addEventListener('click', () => this.remove());

        this.setAttribute('draggable', 'true');
        this.toggleAnswers(); // Set initial state
    }

    toggleAnswers() {
        const type = this.shadowRoot.querySelector('.type').value;
        const answerSection = this.shadowRoot.querySelector('.answers');
        const addBtn = this.shadowRoot.querySelector('.add-answer');
        if (type === 'text' || type === 'tableau_activite' || type === 'tableau_accompagnement') {
            answerSection.innerHTML = '';
            addBtn.style.display = 'none';
        } else {
            addBtn.style.display = 'inline-block';
        }
    }

    addAnswer() {
        console.log(this.answerId);
        const answer = document.createElement('answer-editor');
        answer.setAttribute('id', `a${this.answerId++}`);
        this.shadowRoot.querySelector('.answers').appendChild(answer);
    }

    getData() {
        const label = this.shadowRoot.querySelector('.label').value;
        const type = this.shadowRoot.querySelector('.type').value;
        const answers = [...this.shadowRoot.querySelectorAll('answer-editor')].map(a => a.getData());
        return { label, type, answers };
    }

    setData(data) {
        console.log(data);
        this.shadowRoot.getElementById('question-text').value = data.intitule;
        this.shadowRoot.getElementById('question-type').selectedIndex = data.type;

        const container = this.shadowRoot.querySelector('.answers');
        container.innerHTML = '';

        data.reponse.forEach(answer => {
            const answerEditor = document.createElement('answer-editor');
            container.appendChild(answerEditor);
            answerEditor.setData(answer);
        });
    }
}

customElements.define('question-editor', QuestionEditor);