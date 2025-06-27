package com.example.pointvertformulaire.models

/**
 * Type de réponse possible pour une question.
 */
enum class QuestionType {
    TEXTE,
    RADIO,
    CHECKBOX,
    TABLEAU_ACTIVITE,
    TABLEAU_ACCOMPAGNEMENT
}

/**
 * Modèle représentant une question.
 * @param id Identifiant unique de la question
 * @param texte Intitulé de la question
 * @param type Type de la réponse: TEXTE, RADIO, CHECKBOX
 * @param options Liste des options (seulement pour radio et checkbox)
 */
data class Question(
    val id: Int,
    val texte: String,
    val type: QuestionType,
    val options: List<Option> = emptyList()
)
