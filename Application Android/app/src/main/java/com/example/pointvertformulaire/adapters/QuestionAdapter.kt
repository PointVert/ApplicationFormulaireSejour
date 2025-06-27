package com.example.pointvertformulaire.adapters

import android.graphics.Bitmap
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.core.view.children
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.bumptech.glide.request.target.CustomTarget
import com.bumptech.glide.request.transition.Transition
import com.example.pointvertformulaire.R
import com.example.pointvertformulaire.models.Question
import com.example.pointvertformulaire.models.QuestionType
import com.example.pointvertformulaire.models.Option

class QuestionAdapter(private var questions: List<Question>) :
    RecyclerView.Adapter<QuestionAdapter.QuestionViewHolder>() {

    private var savedAnswers: Map<Int, Any> = emptyMap()
    private val answerMap = mutableMapOf<Int, Any>()
    private val viewHolders = mutableMapOf<Int, QuestionViewHolder>()

    inner class QuestionViewHolder(val layout: LinearLayout) : RecyclerView.ViewHolder(layout) {
        val questionText: TextView = layout.findViewById(R.id.question_text)
        val answerContainer: LinearLayout = layout.findViewById(R.id.answer_container)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): QuestionViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.question_template, parent, false) as LinearLayout
        return QuestionViewHolder(view)
    }

    override fun onBindViewHolder(holder: QuestionViewHolder, position: Int) {
        val question = questions[position]
        holder.questionText.text = question.texte
        holder.answerContainer.removeAllViews()
        viewHolders[question.id] = holder
        Log.d("QuestionAdapter", "Holder registered: ${question.id}")
        val context = holder.layout.context

        when (question.type) {
            QuestionType.TEXTE -> {
                val editText = EditText(context)
                editText.layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                )
                editText.setText((answerMap[question.id] ?: savedAnswers[question.id])?.toString().orEmpty())
                editText.addTextChangedListener(object : android.text.TextWatcher {
                    override fun afterTextChanged(s: android.text.Editable?) {
                        answerMap[question.id] = s.toString()
                    }
                    override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
                    override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
                })

                editText.setOnFocusChangeListener { _, hasFocus ->
                    if (!hasFocus) {
                        answerMap[question.id] = editText.text.toString()
                    }
                }
                holder.answerContainer.addView(editText)
            }

            QuestionType.RADIO -> {
                val radioGroup = RadioGroup(context)
                radioGroup.orientation = RadioGroup.VERTICAL
                val selectedAnswer = (answerMap[question.id] ?: savedAnswers[question.id])?.toString()
                var selectedRadioId: Int? = null

                for (option in question.options) {
                    val radioButton = RadioButton(context).apply {
                        text = option.label
                        id = View.generateViewId()
                    }

                    if (radioButton.text == selectedAnswer) {
                        selectedRadioId = radioButton.id
                    }

                    option.imageUrl?.let { url ->
                        Glide.with(context)
                            .asBitmap()
                            .load(url)
                            .into(object : CustomTarget<Bitmap>(200, 200) {
                                override fun onResourceReady(resource: Bitmap, transition: Transition<in Bitmap>?) {
                                    val drawable = BitmapDrawable(context.resources, resource)
                                    drawable.setBounds(0, 0, drawable.intrinsicWidth, drawable.intrinsicHeight)
                                    radioButton.setCompoundDrawablesRelative(null, null, drawable, null)
                                    radioButton.compoundDrawablePadding = 16
                                }

                                override fun onLoadCleared(placeholder: Drawable?) {}
                            })
                    }

                    radioGroup.addView(radioButton)
                }

                selectedRadioId?.let {
                    radioGroup.check(it)
                }

                radioGroup.setOnCheckedChangeListener { group, checkedId ->
                    val button = group.findViewById<RadioButton>(checkedId)
                    answerMap[question.id] = button?.text.toString()
                }

                holder.answerContainer.addView(radioGroup)
            }

            QuestionType.CHECKBOX -> {
                val selected = (answerMap[question.id] ?: savedAnswers[question.id]) as? List<*> ?: emptyList<Any>()
                val currentSelections = mutableListOf<String>()

                for (option in question.options) {
                    val container = LinearLayout(context).apply {
                        orientation = LinearLayout.HORIZONTAL
                    }
                    val checkBox = CheckBox(context).apply {
                        text = option.label
                        isChecked = selected.contains(text)
                    }
                    checkBox.setOnCheckedChangeListener { _, isChecked ->
                        if (isChecked) currentSelections.add(checkBox.text.toString())
                        else currentSelections.remove(checkBox.text.toString())
                        answerMap[question.id] = currentSelections.toList()
                    }
                    container.addView(checkBox)

                    option.imageUrl?.let { url ->
                        val image = ImageView(context).apply {
                            layoutParams = LinearLayout.LayoutParams(200, 200)
                        }
                        Glide.with(context).load(url).into(image)
                        container.addView(image)
                    }
                    holder.answerContainer.addView(container)
                }
            }

            QuestionType.TABLEAU_ACTIVITE -> {
                val container = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
                val table = TableLayout(context)
                table.layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)

                val headerRow = TableRow(context)
                listOf("Activité", "Retour de l'activité", "Commentaire").forEach {
                    val textView = TextView(context)
                    textView.text = it
                    headerRow.addView(textView)
                }
                table.addView(headerRow)

                val saved = savedAnswers[question.id] as? List<String> ?: emptyList()
                val initialCount = saved.size.takeIf { it > 0 } ?: 10

                for (i in 0 until initialCount) {
                    val row = createActivityRowWithRadios(context)
                    saved.getOrNull(i)?.let { raw ->
                        val parts = raw.split("_")
                        val activityName = parts.getOrNull(0).orEmpty()
                        val retour = parts.getOrNull(1).orEmpty()
                        val comment = parts.getOrNull(2).orEmpty()

                        (row.getChildAt(0) as? EditText)?.setText(activityName)
                        val group = row.getChildAt(1) as? RadioGroup
                        group?.children?.forEach { btn ->
                            if ((btn as RadioButton).text == retour) group.check(btn.id)
                        }
                        (row.getChildAt(2) as? EditText)?.setText(comment)
                    }
                    table.addView(row)
                }

                val addButton = Button(context).apply {
                    text = "+ Ajouter une ligne"
                    setOnClickListener { table.addView(createActivityRowWithRadios(context)) }
                }

                container.addView(table)
                container.addView(addButton)
                holder.answerContainer.addView(container)
                answerMap[question.id] = table
            }

            QuestionType.TABLEAU_ACCOMPAGNEMENT -> {
                val table = TableLayout(context)
                table.layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
                val saved = savedAnswers[question.id] as? List<String> ?: emptyList()
                val activities = listOf("habillage", "faire sa toilette", "hygiene", "manger", "se deplacer", "repos/sommeil")

                for (i in activities.indices) {
                    val row = TableRow(context)
                    val activityText = TextView(context)
                    val label = activities[i]
                    activityText.text = label
                    row.addView(activityText)

                    val radioGroup = RadioGroup(context).apply { orientation = RadioGroup.HORIZONTAL }
                    listOf("Sans aide", "Avec soutien verbal", "Avec aide ponctuelle").forEach { option ->
                        val rb = RadioButton(context).apply { text = option }
                        radioGroup.addView(rb)
                    }
                    val savedRow = saved.getOrNull(i)?.split("_") ?: emptyList()
                    if (savedRow.getOrNull(1) != null) {
                        val idx = radioGroup.children.indexOfFirst { (it as RadioButton).text == savedRow[1] }
                        if (idx >= 0) radioGroup.check(radioGroup.getChildAt(idx).id)
                    }
                    row.addView(radioGroup)

                    val commentaire = EditText(context).apply {
                        hint = "Commentaire"
                        setText(savedRow.getOrNull(2).orEmpty())
                    }
                    row.addView(commentaire)

                    table.addView(row)
                }

                holder.answerContainer.addView(table)
                answerMap[question.id] = table
            }
        }
    }

    private fun createActivityRowWithRadios(context: android.content.Context): TableRow {
        val row = TableRow(context)
        val editText = EditText(context).apply { hint = "Activité" }
        val commentaire = EditText(context).apply { hint = "Commentaire" }
        val radioGroup = RadioGroup(context).apply { orientation = RadioGroup.HORIZONTAL }
        listOf("Aime", "Aime pas", "Pas participé").forEach { option ->
            val radioButton = RadioButton(context).apply { text = option }
            radioGroup.addView(radioButton)
        }
        row.addView(editText)
        row.addView(radioGroup)
        row.addView(commentaire)
        return row
    }

    fun updateQuestions(newQuestions: List<Question>, answers: Map<Int, Any>?) {
        this.questions = newQuestions
        this.savedAnswers = answers ?: emptyMap()
        this.answerMap.clear()
        this.answerMap.putAll(this.savedAnswers)
        notifyDataSetChanged()
    }

    override fun getItemCount(): Int = questions.size

    fun collectAnswers(): Map<Int, Any> {
        val answers = mutableMapOf<Int, Any>()

        answers.putAll(this.answerMap)
        viewHolders.forEach { (questionId, holder) ->
            val question = questions.find { it.id == questionId }
            if (question == null) {
                Log.w("QuestionAdapter", "Question not found for ID: $questionId")
                return@forEach
            }

            when (question.type) {
                QuestionType.TEXTE -> {
                    val editText = holder.answerContainer.getChildAt(0) as? EditText
                    val value = editText?.text?.toString()?.trim()
                    if (!value.isNullOrEmpty()) {
                        answers[questionId] = value
                    }
                }
                QuestionType.RADIO -> {
                    val radioGroup = (0 until holder.answerContainer.childCount)
                        .map { holder.answerContainer.getChildAt(it) }
                        .find { it is RadioGroup } as? RadioGroup

                    val checkedId = radioGroup?.checkedRadioButtonId
                    val radioButton = checkedId?.let { radioGroup.findViewById<RadioButton>(it) }
                    val label = radioButton?.text?.toString()
                    if (!label.isNullOrEmpty()) answers[questionId] = label
                }
                QuestionType.CHECKBOX -> {
                    val values = mutableListOf<String>()
                    for (i in 0 until holder.answerContainer.childCount) {
                        val child = holder.answerContainer.getChildAt(i)
                        if (child is ViewGroup) {
                            for (j in 0 until child.childCount) {
                                val checkBox = child.getChildAt(j) as? CheckBox
                                if (checkBox?.isChecked == true) {
                                    values.add(checkBox.text.toString())
                                }
                            }
                        }
                    }
                    if (values.isNotEmpty()) {
                        answers[questionId] = values
                    }
                }
                QuestionType.TABLEAU_ACTIVITE -> {
                    val table = answerMap[questionId] as? TableLayout ?: return@forEach
                    val activityAnswers = mutableListOf<String>()
                    for (i in 1 until table.childCount) {
                        val row = table.getChildAt(i) as? TableRow ?: continue
                        val activity = (row.getChildAt(0) as? EditText)?.text?.toString()?.trim() ?: continue
                        val radioGroup = row.getChildAt(1) as? RadioGroup ?: continue
                        val selected = radioGroup.findViewById<RadioButton>(radioGroup.checkedRadioButtonId)?.text?.toString()
                        val comment = (row.getChildAt(2) as? EditText)?.text?.toString()?.trim().orEmpty()
                        if (activity.isNotEmpty())
                            activityAnswers.add("${activity}_${selected}_$comment")
                    }
                    answers[questionId] = activityAnswers
                }
                QuestionType.TABLEAU_ACCOMPAGNEMENT -> {
                    val table = answerMap[questionId] as? TableLayout ?: return@forEach
                    val accompAnswers = mutableListOf<String>()
                    for (i in 0 until table.childCount) {
                        val row = table.getChildAt(i) as? TableRow ?: continue
                        val activity = (row.getChildAt(0) as? TextView)?.text?.toString()?.trim() ?: continue
                        val radioGroup = row.getChildAt(1) as? RadioGroup ?: continue
                        val checkedId = radioGroup.checkedRadioButtonId
                        val aide = radioGroup.findViewById<RadioButton>(checkedId)?.text?.toString()?.trim().orEmpty()
                        val commentaire = (row.getChildAt(2) as? EditText)?.text?.toString()?.trim().orEmpty()
                        accompAnswers.add("${activity}_${aide}_$commentaire")
                    }
                    answers[questionId] = accompAnswers
                }
            }
        }

        Log.d("QuestionAdapter", "Answers collected: $answers")
        return answers
    }
}
