import { AIQuestion, ConvertedQuestion, Question } from "./interfaces";

export function AIQuestionToDBQuestion(q: AIQuestion): ConvertedQuestion {
    let c = 0;

    for (let i = 0; i < q.answers.length; i++) {
        if (q.answers[i].correct) {
            c = i;
            break;
        }
        i++;
    }

    return {
        question: q.question,
        answer_0: q.answers[0].text,
        answer_1: q.answers[1].text,
        answer_2: q.answers[2].text,
        answer_3: q.answers[3].text,
        correct: c
    }
}

export function DBQuestionToAIQuestion(q: Question): AIQuestion {
    return {
        id: q.id,
        question: q.question,
        answers: [
            {
                text: q.answer_0,
                correct: 0 == q.correct
            },
            {
                text: q.answer_1,
                correct: 1 == q.correct
            },
            {
                text: q.answer_2,
                correct: 2 == q.correct
            },
            {
                text: q.answer_3,
                correct: 3 == q.correct
            }
        ]
    }
}