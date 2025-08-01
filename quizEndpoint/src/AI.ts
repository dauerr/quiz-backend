import OpenAI from 'openai';
import { AIQuestion } from './interfaces';
import { Database } from './Database';

export class AI {
    private openai: OpenAI;

    constructor() {
        const apiKey = process.env.OPENAI_API_KEY;
        this.openai = new OpenAI({ apiKey });
    }

    /**
     * getFunFacts - IMPLEMENTED TO ENDPOINT
     * @param topic 
     * @param languageCode 
     * @returns string of funfacts
     */
    public async getFunFacts(topic: string, languageCode: string): Promise<string[]> {
        console.log(`getFunFacts`);
        const language = this.languageForPrompt(languageCode);
        const wikipedia = await this.fetchWikipediaExtract(topic, languageCode);

        const prompt = `
        You are a pop-culture-savvy trivia writer creating 10 fun and surprising facts.

        Topic: ${topic}
        Seed: ${Date.now()}
        Language: ${language}

        IMPORTANT: The user's language is ${language}. Provide only ${language} responses.

        Here is some validated and true information from wikipedia about this topic. Use it to help you find some fun facts:
        ### START OF INFORMATION ###

        ${wikipedia}

        ### END OF INFORMATION ###

        Guidelines:
        - Each fact must be accurate, concise, and phrased in an engaging way.
        - Facts must not repeat — cover a variety of angles (e.g., history, pop culture, science, weird-but-true, records, unexpected uses).
        - Use informal, conversational tone — like something from a fun trivia night or a pub quiz.
        - Avoid overly dry or textbook phrasing.
        - Do NOT include questions or opinions — just statements of fact.
        - Do not use any markdown, formatting, or commentary.
        - Every fact must be 100% true and verifiable.

        Output:
        A JSON array of 10 strings, like so:
        [
        "Fun fact 1",
        "Fun fact 2",
        ...
        ]
        Keep in mind: 
        - No extra text, no markdown! It is VERY important that all the information you provide is 100% correct.
        - The reply has to be parsed in the next step by the client.`;

        console.log(prompt);

        const openAIResponse = await this.openai.responses.create({
            model: "gpt-3.5-turbo",
            input: prompt,
            temperature: 0.8,
            top_p: 1.0
        });

        const responseText = openAIResponse.output_text.trim();
        console.log(`Got response from ChatGPT: ${responseText}`);

        let finalResponse: string[];
        try {
            finalResponse = JSON.parse(responseText);
        } catch (e) {
            console.error(`Response could not be parsed ${JSON.stringify(e)}`);
            throw new Error(`Response could not be parsed ${JSON.stringify(e)}`);
        }

        return finalResponse;
    }

    /**
     * 
     * @param topic 
     * @returns string with fitting emoji
     */
    public async getEmoji(topic: string): Promise<string> {
        console.log(`getEmoji`);
        const prompt = `
        You are a quiz AI that receives a single topic or concept as input and responds with one emoji that best represents or matches that topic. 
        The emoji should be relevant, intuitive, and ideally recognizable by most users. 
        Avoid obscure or rarely used emojis. Do not include any explanation—just return the emoji.
        
        Examples:

        Input: Fire
        Output: 🔥

        Input: Space
        Output: 🚀

        Input: Love
        Output: ❤️

        Now, given the topic: ${topic}, return the most fitting emoji. 
        Keep in mind: No extra text, no markdown! The reply has to be parsed in the next step by the client. Just reply with the emoji
        `;

        const openAIResponse = await this.openai.responses.create({
            model: 'gpt-3.5-turbo',
            input: prompt
        });

        const rsp = openAIResponse.output_text.trim();
        console.log(`getEmoji: ${rsp}`);
        return rsp;
    }

    /**
     * 
     * @param question 
     * @param userAnswer 
     * @param answer 
     * @param languageCode 
     * @returns explanation for question
     */
    public async getExplanation(question: string, userAnswer: string, answer: string, languageCode: string): Promise<string> {
        console.log(`getExplanation`);
        const language = this.languageForPrompt(languageCode);

        const prompt = `
        You are an expert educator who excels at making complex ideas easy to understand for learners of all backgrounds. 
        I will give you a question and its answer. Please provide a clear, detailed explanation of why this answer is correct. 
        Use examples, analogies, or step-by-step reasoning to make your explanation as helpful as possible.
        
        Question: ${question}  
        Answer: ${answer}
        User's Answer: ${userAnswer}
        Language: ${language}

        Guidelines:
        - Keep your explanation short.
        - No extra text, no markdown! 
        - It is VERY important that all the information you provide is 100% correct.
        - The reply has to be parsed in the next step by the client.
        - Do not include anything else but the core explanation just return the text.
        - Return the explation only in ${language}`;

        console.log(prompt);

        const openAIResponse = await this.openai.responses.create({
            model: 'gpt-4o',
            input: prompt,
            temperature: 0.8,
            top_p: 1.0
        });

        const responseText = openAIResponse.output_text.trim();
        console.log(`Got response from ChatGPT: ${responseText}`);

        return responseText;
    }

    /**
     * 
     * @param userId 
     * @param topic 
     * @param difficulty 
     * @param languageCode 
     * @returns array of questions
     */
    public async getQuiz(userId: string, topic: string, difficulty: number, languageCode: string): Promise<AIQuestion[]> {
        console.log(`getFunFacts`);
        const language = this.languageForPrompt(languageCode);

        // userid should be a string at some point in time:
        const user = parseInt(userId);
        const db = new Database();
        const unsolved = await db.getUnsolvedQuizzes(user, languageCode, topic, difficulty);
        if (unsolved.length > 0) {
            console.log(`Found unsolved quizzes for user ${userId}`);
            db.shutdown()
            return unsolved;
        }

        const wikipedia = await this.fetchWikipediaExtract(topic, languageCode);
        const avoidSection = await this.buildAvoidSection(topic, languageCode);

        const prompt = `${this.getPersona(difficulty)}
        Topic: ${topic}  
        Difficulty: ${this.difficultyToString(difficulty)}
        Seed: ${Date.now()}
        Language: ${language}

        ${avoidSection}

        IMPORTANT: The user's language is ${language}. Provide only ${language} questions and answers.

        Here is some validated and true information from wikipedia about this topic. Use it to help you build this quiz:
        ### START OF INFORMATION ###
        ${wikipedia}
        ### END OF INFORMATION ###

        Guidelines:
        - Generate 10 multiple choice questions
        - Each question must be different in focus (cover different facts, subtopics, or angles within the topic).
        - Use a mix of styles (facts, pop culture tie-ins, situational/hypothetical, odd but true).
        - Each question must have exactly 4 answer choices.
        - Only one correct answer per question. Distractors must be plausible, topic-relevant, and clearly incorrect.
        - Randomize the correct answer's position across the options.
        - Keep the wording fun and engaging, while staying concise.
        - Avoid repeating facts or phrasing between questions.
        - Keep the questions short and under 60 characters.
        - The question MUST NOT include the answer.

        Output as a JSON array of question objects only, NO MARKDOWN, just raw text:
        Format:
        [
        {
            "question": "...?",
            "answers": [
            {"text": "Option A", "correct": true/false},
            {"text": "Option B", "correct": true/false},
            {"text": "Option C", "correct": true/false},
            {"text": "Option D", "correct": true/false}
            ]
        },
        ...
        ]

        IMPORTANT:
        - No extra text, no markdown! 
        - It is VERY important that all the information you provide is 100% correct.
        - The reply has to be parsed in the next step by the client.
        - Write all output, including options and question text, exclusively in ${language}. Do not include translations.
        - When creating questions make them harder than the questions that were asked before.
        `;

        console.log(prompt);

        const openAIResponse = await this.openai.responses.create({
            model: 'gpt-4o',
            input: prompt,
            temperature: 0.8,
            top_p: 1.0
        });

        const responseText = openAIResponse.output_text.trim();
        console.log(`Got response from ChatGPT: ${responseText}`);

        let questions: AIQuestion[];
        try {
            questions = JSON.parse(responseText.replace('```json', '').replace('```',''));
        } catch (e) {
            console.error(`Response could not be parsed ${JSON.stringify(e)}`);
            throw new Error(`Response could not be parsed ${JSON.stringify(e)}`);
        }

        // await db.addQuestions(questions, topic, difficulty, languageCode);
        //await db.shutdown();

        //return questions;
        const insertedIds = await db.addQuestions(questions, topic, difficulty, languageCode);
        await db.shutdown();

// Attach IDs to each question
        let questionsWithIds: AIQuestion[] = [];
        if (insertedIds.length == questions.length) {
            for (let i = 0; i < insertedIds.length; i++) {
                questionsWithIds.push({
                    id: insertedIds[i],
                    question: questions[i].question,
                    answers: questions[i].answers
                });
            } 
        }

        return questionsWithIds;
    }

    private languageForPrompt(lang: string): string {
        switch (lang) {
            case "en": return "English";
            case "de": return "German";
            case "ru": return "Russian";
            case "fr": return "French";
            case "bar": return "Bavarian";
            default: return "English"
        }
    }

    private async buildAvoidSection(topic: string, language: string): Promise<string> {
        const db = new Database();
        const questions = await db.getQuestionsByTopic(topic, language);
        await db.shutdown();

        if (questions.length > 0) {
            let tmpStr = `Avoid all of the following questions and questions that are related or sound similar:\n`;
            for (const q of questions) {
                tmpStr = `${tmpStr}\n${q.question}`;
            }
            return tmpStr;
        }

        return "";
    }

    private async fetchWikipediaExtract(topic: string, language: string): Promise<string> {
        const endpoint = `https://${language}.wikipedia.org/w/api.php`;
        const params = new URLSearchParams({
            action: 'query',
            prop: 'extracts',
            format: 'json',
            titles: topic,
            explaintext: 'false',
            exintro: '',
            exsectionformat: 'plain',
            origin: '*'
        });

        const url = `${endpoint}?${params.toString()}`;
        console.log(`Requesting wikipedia: ${url}`);
        try {
            const response = await fetch(url);
            const data = await response.json();

            const pages = data?.query?.pages;
            const pageId = Object.keys(pages)[0];
            const extract = pages[pageId]?.extract;

            return extract || 'No extract found.';
        } catch (error) {
            console.error('Error fetching extract:', error);
            return 'Error occurred while fetching extract.';
        }
    }

    private difficultyToString(difficulty: number): string {
        switch (difficulty) {
            case 1:
                return `Intermediate - For users with solid general knowledge.
                        - Focus on concepts that require basic reasoning or familiarity with key ideas.
                        - Questions can explore relationships, causes, or comparisons.
                        - Avoid trivial facts, but don't assume deep expertise.
                        - Use clear language; occasional technical terms are okay if explained.
                        `;
            case 2:
                return `Advanced - For users with deep topic knowledge or expertise.
                        - Assume familiarity with domain-specific terminology and advanced concepts.
                        - Ask challenging, analytical questions involving subtle distinctions or uncommon facts.
                        - You may include niche references, historical context, or multi-step reasoning.
                        - Use technical or academic tone, but keep questions under 60 characters.
                        `;
            default:
                return `Beginner - For casual users with little or no background.
                        - Stick to basic facts, definitions, or high-level ideas.
                        - Use simple, friendly language with no jargon or complex reasoning.
                        - Questions should feel fun, visual, or curiosity-driven.
                        - Avoid rare names, dates, or specialized terms.
                        `;
        }
    }

    private getPersona(difficulty: number): string {
        const beginnerPersonas = [
            `You are a cheerful guide who makes every topic feel welcoming and easy. You use vivid analogies, playful examples, and keep questions simple and visual. You assume the user has no prior knowledge and focus on building confidence.`,
            `You are a curious beginner who learns alongside the user. You ask fun, friendly questions and often frame them as imaginative or relatable situations. No jargon, no pressure—just light discovery.`,
            `You are a creative storyteller who turns every quiz into a small adventure. Whether it's history, science, or pop culture, you frame each question with a memorable scene or character. The tone is friendly and engaging.`,
            `You are an encouraging explorer who invites users to join you on a journey through basic concepts. You celebrate effort, simplify complex ideas, and turn learning into a fun experience.`
        ];

        const intermediatePersonas = [
            `You are a thoughtful instructor who guides users through moderately challenging questions. You expect some prior exposure to the topic and encourage reasoning, comparisons, and curiosity.`,
            `You are a passionate enthusiast who dives a bit deeper into the subject. Your questions highlight patterns, causes, and relationships, helping users connect the dots.`,
            `You are a friendly classmate who discusses topics openly and collaboratively. You pose questions that require logic and understanding, not just memorization. You make learning feel like a conversation.`,
            `You are a curious analyst who loves exploring the "why" behind things. Your questions often introduce short scenarios, and you're comfortable using basic technical language if it helps clarify a point.`
        ];

        const advancedPersonas = [
            `You are a domain expert who challenges users with high-level questions. You assume strong prior knowledge and expect precision, synthesis, and critical thinking in response to your prompts.`,
            `You are a subject matter mentor who frames questions with depth and context. You reference theories, uncommon facts, or recent developments. Your tone is academic but engaging.`,
            `You are a researcher who thrives on nuance. You pose complex or open-ended questions that require careful interpretation, and you appreciate subtleties or edge cases.`,
            `You are a rigorous challenger who pushes boundaries. Your questions are dense, thought-provoking, and may require users to evaluate competing perspectives or abstract reasoning.`
        ];

        const personaPool =
            difficulty === 2
                ? advancedPersonas
                : difficulty === 1
                    ? intermediatePersonas
                    : beginnerPersonas;

        const randomIndex = Math.floor(Math.random() * personaPool.length);
        return personaPool[randomIndex];
    }

}