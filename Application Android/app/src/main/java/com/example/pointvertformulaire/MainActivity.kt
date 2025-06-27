package com.example.pointvertformulaire

import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Log
import android.Manifest
import android.view.MenuItem
import android.widget.Button
import android.widget.Toast
import androidx.appcompat.app.ActionBarDrawerToggle
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.view.GravityCompat
import androidx.drawerlayout.widget.DrawerLayout
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.navigation.NavigationView
import com.example.pointvertformulaire.adapters.QuestionAdapter
import com.example.pointvertformulaire.models.Question
import com.example.pointvertformulaire.models.QuestionType
import com.example.pointvertformulaire.models.Option
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

const val BASE_URL = "https://applicationformulairesejour.onrender.com"

class MainActivity : AppCompatActivity(), NavigationView.OnNavigationItemSelectedListener {
    private lateinit var drawerLayout: DrawerLayout
    private lateinit var navigationView: NavigationView
    private lateinit var recyclerView: RecyclerView
    private lateinit var submitForPDFButton: Button
    private lateinit var submitToSaveButton: Button
    private var currentFormId: Int? = null
    private var currentQuestions: List<Question> = emptyList()

    private val REQUEST_RECORD_AUDIO_PERMISSION = 200
    data class Formulaire(val id: Int, val nom: String)
    private var token : String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        token = getSharedPreferences("auth", MODE_PRIVATE).getString("jwt", null)

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED) {

            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.RECORD_AUDIO),
                REQUEST_RECORD_AUDIO_PERMISSION
            )
        }
        val toolbar = findViewById<Toolbar>(R.id.toolbar)
        setSupportActionBar(toolbar)

        drawerLayout = findViewById(R.id.drawer_layout)
        navigationView = findViewById(R.id.nav_view)
        recyclerView = findViewById(R.id.question_recycler_view)
        submitForPDFButton = findViewById(R.id.submit_button)
        submitToSaveButton = findViewById(R.id.save_button)

        recyclerView.layoutManager = LinearLayoutManager(this)
        navigationView.setNavigationItemSelectedListener(this)

        val toggle = ActionBarDrawerToggle(
            this, drawerLayout, toolbar,
            R.string.navigation_drawer_open, R.string.navigation_drawer_close
        )
        drawerLayout.addDrawerListener(toggle)
        toggle.syncState()

        submitForPDFButton.setOnClickListener {
            val adapter = recyclerView.adapter
            if (adapter is QuestionAdapter) {
                val answers = adapter.collectAnswers()
                submitAnswers(answers, "answers-pdf")
            }
        }
        submitToSaveButton.setOnClickListener {
            val adapter = recyclerView.adapter
            if (adapter is QuestionAdapter) {
                val answers = adapter.collectAnswers()
                submitAnswers(answers, "progress")
            }
        }
        fetchFormulairesFromApi { formulaires ->
            runOnUiThread {
                val menu = navigationView.menu
                val dynamicGroupItem = menu.addSubMenu("Formulaires disponibles")
                dynamicGroupItem.clear() // vider avant de remplir
                for (formulaire in formulaires) {
                    val item = dynamicGroupItem.add(formulaire.nom)
                    item.setOnMenuItemClickListener {
                        currentFormId = formulaire.id
                        fetchQuestionsFromApi(formulaire)
                        drawerLayout.closeDrawer(GravityCompat.START)
                        true
                    }
                }
                fetchQuestionsFromApi(formulaires.last())
            }
        }
        loadSavedResponseGroups()
    }
    private fun fetchQuestionsFromApi(formData: Formulaire) {
        Toast.makeText(this, "Formulaire ${formData.nom} sélectionné", Toast.LENGTH_SHORT).show()
        currentFormId = formData.id;
        currentQuestions = emptyList();
        thread {
            try {
                val url = URL("${BASE_URL}/api/forms/${formData.id}")
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "GET"
                connection.setRequestProperty("Authorization", "Bearer $token")
                connection.connect()

                val response = connection.inputStream.bufferedReader().use { it.readText() }
                val jsonObject = JSONObject(response)
                val questionsArray = jsonObject.getJSONArray("questions")

                val questions = mutableListOf<Question>()

                questions.add(Question(
                    id = -1,
                    texte = "Nom de Sauvegarde/fichier",
                    type = QuestionType.TEXTE,
                    options = emptyList()
                ))
                questions.add(Question(
                    id = -2,
                    texte = "Nom Prénom",
                    type = QuestionType.TEXTE,
                    options = emptyList()
                ))
                questions.add(Question(
                    id = -3,
                    texte = "Lieu de Séjour",
                    type = QuestionType.TEXTE,
                    options = emptyList()
                ))
                questions.add(Question(
                    id = -4,
                    texte = "Date",
                    type = QuestionType.TEXTE,
                    options = emptyList()
                ))

                for (i in 0 until questionsArray.length()) {
                    val q = questionsArray.getJSONObject(i)
                    val id = q.getInt("id_question")
                    val texte = q.getString("intitule")
                    val typeInt = q.getInt("type")
                    val type = when (typeInt) {
                        0 -> QuestionType.TEXTE
                        1 -> QuestionType.RADIO
                        2 -> QuestionType.CHECKBOX
                        3 -> QuestionType.TABLEAU_ACTIVITE
                        4 -> QuestionType.TABLEAU_ACCOMPAGNEMENT
                        else -> QuestionType.TEXTE
                    }
                    val optionsList = mutableListOf<Option>()
                    if (q.has("reponse")) {
                        val optionsArray = q.getJSONArray("reponse")
                        for (j in 0 until optionsArray.length()) {
                            val o = optionsArray.getJSONObject(j)
                            optionsList.add(
                                Option(
                                    label = o.getString("intitule"),
                                    imageUrl = if (o.has("url_image")) "$BASE_URL${o.getString("url_image")}" else null
                                )
                            )
                        }
                    }
                    questions.add(Question(id, texte, type, optionsList))
                }
                currentQuestions = questions;
                runOnUiThread {
                    recyclerView.adapter = QuestionAdapter(questions)
                }

            } catch (e: Exception) {
                e.printStackTrace()
                runOnUiThread {
                    Toast.makeText(this, "Erreur: ${e.localizedMessage}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun fetchFormulairesFromApi(callback: (List<Formulaire>) -> Unit) {
        thread {
            try {
                val url = URL("$BASE_URL/api/forms")
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "GET"
                connection.setRequestProperty("Authorization", "Bearer $token")
                connection.connect()

                val response = connection.inputStream.bufferedReader().use { it.readText() }
                val jsonArray = JSONArray(response)

                val formulaires = mutableListOf<Formulaire>()
                for (i in 0 until jsonArray.length()) {
                    val obj = jsonArray.getJSONObject(i)
                    val id = obj.getInt("identifiant_formulaire")
                    val nom = obj.getString("titre")
                    formulaires.add(Formulaire(id, nom))
                }

                callback(formulaires)
            } catch (e: Exception) {
                e.printStackTrace()
                runOnUiThread {
                    Toast.makeText(this, "Erreur: ${e.localizedMessage}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        val toggle = ActionBarDrawerToggle(
            this, drawerLayout, R.string.navigation_drawer_open, R.string.navigation_drawer_close
        )
        return if (toggle.onOptionsItemSelected(item)) true else super.onOptionsItemSelected(item)
    }
    override fun onNavigationItemSelected(item: MenuItem): Boolean {
        return true
    }

    fun fetchFormAndInjectAnswers(formId: Int, savedAnswers: Map<Int, Any>) {
        thread {
            try {
                val url = URL("$BASE_URL/api/forms/$formId")
                val connection = url.openConnection() as HttpURLConnection
                connection.setRequestProperty("Authorization", "Bearer $token")
                val response = connection.inputStream.bufferedReader().readText()

                val json = JSONObject(response)
                val questionsArray = json.getJSONArray("questions")
                val questions = mutableListOf<Question>()
                questions.add(Question(
                    id = -1,
                    texte = "Nom de Sauvegarde/fichier",
                    type = QuestionType.TEXTE,
                    options = emptyList()
                ))
                questions.add(Question(
                    id = -2,
                    texte = "Nom Prénom",
                    type = QuestionType.TEXTE,
                    options = emptyList()
                ))
                questions.add(Question(
                    id = -3,
                    texte = "Lieu de Séjour",
                    type = QuestionType.TEXTE,
                    options = emptyList()
                ))
                questions.add(Question(
                    id = -4,
                    texte = "Date",
                    type = QuestionType.TEXTE,
                    options = emptyList()
                ))

                for (i in 0 until questionsArray.length()) {
                    val q = questionsArray.getJSONObject(i)
                    val id = q.getInt("id_question")
                    val texte = q.getString("intitule")
                    val typeInt = q.getInt("type")
                    val type = when (typeInt) {
                        0 -> QuestionType.TEXTE
                        1 -> QuestionType.RADIO
                        2 -> QuestionType.CHECKBOX
                        3 -> QuestionType.TABLEAU_ACTIVITE
                        4 -> QuestionType.TABLEAU_ACCOMPAGNEMENT
                        else -> QuestionType.TEXTE
                    }
                    val optionsList = mutableListOf<Option>()
                    if (q.has("reponse")) {
                        val optionsArray = q.getJSONArray("reponse")
                        for (j in 0 until optionsArray.length()) {
                            val o = optionsArray.getJSONObject(j)
                            optionsList.add(
                                Option(
                                    label = o.getString("intitule"),
                                    imageUrl = if (o.has("url_image")) "$BASE_URL${o.getString("url_image")}" else null
                                )
                            )
                        }
                    }
                    questions.add(Question(id, texte, type, optionsList))
                }
                questions.flatMap { it.options }.forEach {
                    Log.d("OptionDebug", "Option: ${it.label}, Image: ${it.imageUrl}")
                }
                runOnUiThread {
                    var questionAdapter = recyclerView.adapter as QuestionAdapter
                    questionAdapter.updateQuestions(questions, savedAnswers)
                    currentFormId = formId
                }

            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun loadFormWithAnswers(groupId: String) {
        thread {
            try {
                val url = URL("$BASE_URL/api/progress/$groupId")
                val connection = url.openConnection() as HttpURLConnection
                connection.setRequestProperty("Authorization", "Bearer $token")
                val response = connection.inputStream.bufferedReader().readText()
                val jsonArray = JSONArray(response)

                val answersMap = mutableMapOf<Int, Any>()
                var formId = -1

                for (i in 0 until jsonArray.length()) {
                    val ans = jsonArray.getJSONObject(i)
                    if (formId == -1) {
                        formId = ans.getInt("identifiant_formulaire")
                    }
                    val qId = ans.getInt("id_question")
                    val value = ans.opt("reponse_texte") ?: ans.opt("id_reponse")

                    if (value != null) {
                        if (answersMap[qId] == null) {
                            answersMap[qId] = value
                        } else if (answersMap[qId] is MutableList<*>) {
                            (answersMap[qId] as MutableList<Any>).add(value)
                        } else {
                            answersMap[qId] = mutableListOf(answersMap[qId]!!, value)
                        }
                    }
                }
                answersMap[-1] = groupId
                fetchFormAndInjectAnswers(formId, answersMap)

            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
    fun loadSavedResponseGroups() {
        thread {
            try {
                val url = URL("$BASE_URL/api/progress/formulaires/groupes")
                val connection = url.openConnection() as HttpURLConnection
                connection.setRequestProperty("Authorization", "Bearer $token")
                val response = connection.inputStream.bufferedReader().readText()
                val jsonArray = JSONArray(response)

                runOnUiThread {
                    val menu = navigationView.menu
                    val submenu = menu.addSubMenu("📁 Réponses enregistrées")

                    for (i in 0 until jsonArray.length()) {
                        val obj = jsonArray.getJSONObject(i)
                        val formId = obj.getString("identifiant_formulaire")
                        val progressions = obj.getJSONArray("progressions")

                        for (j in 0 until progressions.length()) {
                            val filename = progressions.getString(j)
                            val label = "Formulaire $formId – $filename"

                            val item = submenu.add(label)
                            item.setOnMenuItemClickListener {
                                loadFormWithAnswers(filename)
                                drawerLayout.closeDrawer(GravityCompat.START)
                                true
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun submitAnswers(answers: Map<Int, Any>, route: String) {
        Log.d("MainActivity", "Sending answers: $answers")
        val mandatory = answers[-1]
        Log.d("SubmitDebug", "mandatory = $mandatory (${mandatory?.javaClass})")
        if (mandatory == null || mandatory.toString().isBlank()) {
            runOnUiThread {
                Toast.makeText(this, "Le champ 'Nom du client' est obligatoire", Toast.LENGTH_SHORT).show()
            }
            return
        }
        thread {
            try {
                val formId = currentFormId ?: return@thread
                val json = JSONObject()
                json.put("formId", formId)

                val answersArray = JSONArray()
                for ((questionId, answer) in answers) {
                    val obj = JSONObject()
                    obj.put("question_id", questionId)
                    if (answer is List<*>) {
                        val array = JSONArray()
                        answer.forEach { array.put(it.toString()) }
                        obj.put("answer", array)
                    } else {
                        obj.put("answer", answer.toString())
                    }
                    answersArray.put(obj)
                }
                json.put("answers", answersArray)
                json.put("nameFile", mandatory)
                val url = URL("$BASE_URL/api/$route")
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "POST"
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.setRequestProperty("Accept", "application/json")
                connection.setRequestProperty("Authorization", "Bearer $token")

                val writer = OutputStreamWriter(connection.outputStream)
                writer.write(json.toString())
                writer.flush()
                writer.close()

                val responseCode = connection.responseCode
                runOnUiThread {
                    Toast.makeText(this, "Réponse envoyée ($responseCode)", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                e.printStackTrace()
                runOnUiThread {
                    Toast.makeText(this, "Erreur lors de l'envoi des réponses", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
}