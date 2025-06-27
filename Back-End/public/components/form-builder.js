class FormBuilder extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.questionId = 0;
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
      <style>
        .form-builder { padding: 1rem; border: 1px solid #ccc; }
        button { margin: 0.5rem 0; }
      </style>
      <div class="form-builder">
        <label>Nom du Formulaire: <input type="text" id="formName" /></label>
        <div id="questions"></div>
        <button id="addQuestion">Ajouter une Question</button>
        <button id="submitForm">Enregistrer le formulaire</button>
        <div id="status"></div>
      </div>
    `;

        this.shadowRoot.getElementById('addQuestion')
            .addEventListener('click', () => this.addQuestion());

        this.shadowRoot.getElementById('submitForm')
            .addEventListener('click', () => this.submitForm());


        const container = this.shadowRoot.querySelector('#questions');

        container.addEventListener('dragstart', (e) => {
            e.target.classList.add('dragging');
        });
        container.addEventListener('dragend', (e) => {
            e.target.classList.remove('dragging');
        });
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterEl = getDragAfterElement(container, e.clientY);
            const dragging = container.querySelector('.dragging');
            if (afterEl == null) {
                container.appendChild(dragging);
            } else {
                container.insertBefore(dragging, afterEl);
            }
        });
    }

    addQuestion() {
        const q = document.createElement('question-editor');
        q.setAttribute('id', `q${this.questionId++}`);
        this.shadowRoot.getElementById('questions').appendChild(q);
    }

    submitForm() {
        const formName = this.shadowRoot.getElementById('formName').value;
        const questionEditors = [...this.shadowRoot.querySelectorAll('question-editor')];
        const questions = [];
        const formData = new FormData();

        questionEditors.forEach((qEditor, index) => {
            const qData = qEditor.getData(); // must include `imageFile` and `imageFieldName`
            qData.answers.forEach((answer, aIdx) => {
                if (answer.imageFile) {
                    // Generate unique field name and attach file
                    const fieldName = `q${index}_a${aIdx}_img`;
                    formData.append(fieldName, answer.imageFile);
                    answer.imageFieldName = fieldName;
                }
            });
            questions.push(qData);
        });

        const payload = {
            name: formName,
            questions
        };

        formData.append('data', JSON.stringify(payload));

        fetch('https://applicationformulairesejour.onrender.com/api/forms', {
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('token')
            },
            method: 'POST',
            body: formData
        })
            .then(res => res.json())
            .then(data => {
                this.shadowRoot.getElementById('status').textContent = "Formulaire cree!";
            })
            .catch(err => {
                console.error(err);
                this.shadowRoot.getElementById('status').textContent = "Erreur lors de la creation du formulaire";
            });
    }

    setData(formData) {
        console.log(this.shadowRoot.getElementById('questions'));
        this.shadowRoot.getElementById('formName').value = formData.titre;
        this.shadowRoot.getElementById('questions').innerHTML = ''
        formData.questions.forEach(q => {
            const qEditor = document.createElement('question-editor');
            this.shadowRoot.getElementById('questions').appendChild(qEditor);
            qEditor.setData(q);
        });
    }

}

customElements.define('form-builder', FormBuilder);

function getDragAfterElement(container, y) {
    const els = [...container.querySelectorAll('question-editor:not(.dragging)')];
    return els.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}