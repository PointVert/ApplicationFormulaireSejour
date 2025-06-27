class FormNavbar extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
            <style>
                .navbar-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: pointer;
                    font-weight: bold;
                    margin-bottom: 0.5rem;
                }

                .form-list {
                    list-style: none;
                    padding-left: 1rem;
                    margin: 0;
                    display: none;
                }

                .nav-actions a {
                    text-decoration: none;
                    font-size: 1.2rem;
                    color: #007bff;
                }

                li {
                    cursor: pointer;
                    margin: 0.2rem 0;
                }
            </style>

            <div class="navbar-header" id="toggle-forms">
                <div class="nav-actions">
                    <a href="/user" title="Manage User">Gerer les utilisateurs</a><br>
                    <a href="/role" title="Manage Role">Gerer les roles</a><br>
                    <a href="/pdf" title="Manage PDF">Telecharger PDF</a><br>
                    <span>Forms</span>
                    <a href="/add_form" title="Add Form">+</a>
                    <ul class="form-list"></ul>
                </div>
            </div>
        `;

        this.list = this.querySelector('.form-list');
        this.toggle = this.querySelector('#toggle-forms');

        this.toggle.addEventListener('click', () => {
            this.list.style.display = this.list.style.display === 'none' ? 'block' : 'none';
        });

        this.loadForms();
    }

    async loadForms() {
        const res = await fetch('/api/forms', {
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
        });
        const forms = await res.json();

        this.list.innerHTML = '';

        forms.forEach(form => {
            const li = document.createElement('li');
            li.textContent = form.titre;
            li.addEventListener('click', () => {
                this.dispatchEvent(new CustomEvent('form-selected', {
                    bubbles: true,
                    detail: form
                }));
            });
            this.list.appendChild(li);
        });
    }
}

customElements.define('form-navbar', FormNavbar);