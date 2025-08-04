import mysql, { QueryResult, ResultSetHeader } from 'mysql2';
import { AIQuestion, Question, Topic, User, UserIdRow } from './interfaces';
import { AIQuestionToDBQuestion, DBQuestionToAIQuestion } from './utils';

export class Database {
    private connection = mysql.createConnection({
        host: process.env.DB_HOST,
        user: 'admin',
        password: process.env.DB_PASSWORD,
        database: 'quiz'
    });

    async shutdown(): Promise<void> {
        this.connection.end();
    }

    async query<T extends QueryResult>(q: string, values?: any[]): Promise<T> {
        console.log(`Query: ${q}`);
        return new Promise((resolve, reject) => {
            this.connection.connect((err) => {
                if (err) {
                    console.error('Error connecting to the database:', err.stack);
                    reject({
                        statusCode: 500,
                        body: JSON.stringify({ error: 'Database connection failed' }),
                    });
                    return;
                }
                console.log('Connected to the database');

                this.connection.query<T>(q, values, (err, results) => {
                    if (err) {
                        console.error('Error fetching quizzes:', err);
                        reject({
                            statusCode: 500,
                            body: JSON.stringify({ error: 'Error fetching quizzes' }),
                        });
                        return;
                    }

                    console.log(`Query Result: ${JSON.stringify(results)}`);

                    resolve(results);
                });
            });
        });
    }

    async createUser(name: string): Promise<void> { }

    async addQuestion(question: AIQuestion, topicId: number, difficulty: number, language: string): Promise<void> {
        const q = AIQuestionToDBQuestion(question);
        const sql = `
        INSERT INTO \`quizzes\` (\`question\`, \`difficulty\`, \`language\`, \`category_id\`, \`answer_0\`, \`answer_1\`, \`answer_2\`, \`answer_3\`, \`correct\`) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
        `;
        const values = [
            q.question,
            difficulty,
            language,
            topicId,
            q.answer_0,
            q.answer_1,
            q.answer_2,
            q.answer_3,
            q.correct
        ]
        await this.query(sql, values);
    }

    async addQuestions(questions: AIQuestion[], topic: string, difficulty: number, language: string): Promise<number[]> {
        let topicId: number;
        try {
            topicId = await this.getOrAddTopic(topic, language);
        } catch (e) {
            return Promise.reject(e);
        }

        if (questions.length === 0) return [];

        const sql = `
        INSERT INTO \`quizzes\` 
        (\`question\`, \`difficulty\`, \`language\`, \`category_id\`, \`answer_0\`, \`answer_1\`, \`answer_2\`, \`answer_3\`, \`correct\`)
        VALUES ${questions.map(() => `(?, ?, ?, ?, ?, ?, ?, ?, ?)`).join(", ")}
        `;

        const values: any[] = [];
        for (const q of questions) {
            const dbQ = AIQuestionToDBQuestion(q);
            values.push(
                dbQ.question,
                difficulty,
                language,
                topicId,
                dbQ.answer_0,
                dbQ.answer_1,
                dbQ.answer_2,
                dbQ.answer_3,
                dbQ.correct
            );
        }

        const result = await this.query<ResultSetHeader>(sql, values);

        const insertedIds = Array.from({ length: result.affectedRows }, (_, i) => result.insertId + i);

        return insertedIds;
    }

    async getOrAddTopic(topic: string, language: string): Promise<number> {
        try {
            const element = await this.getTopicIdByName(topic);
            return element.category_id;
        } catch (e) {
            await this.addTopic(topic, language);
        }
        try {
            const element = await this.getTopicIdByName(topic);
            return element.category_id;
        } catch (e) {
            return Promise.reject(e);
        }
    }

    async getTopicIdByName(topic: string): Promise<Topic> {
        const sql = `SELECT category_id FROM categories WHERE title = "${topic}"`;
        const ids = await this.query<Topic[]>(sql)
            .catch((err) => {
                return {
                    statusCode: 500,
                    body: JSON.stringify(err),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            });
        await this.query(sql);
        if (ids instanceof Array) {
            if (ids.length > 0) {
                return ids[0]
            }
        }
        return Promise.reject(`Topic ${topic} not found`);
    }

    async addTopic(topic: string, language: string): Promise<void> {
        const sql = `
        INSERT INTO \`categories\` (\`title\`, \`language\`) 
        VALUES (?, ?);
        `;
        const values = [
            topic,
            language
        ]
        await this.query(sql, values);
    }

    async getUserIdForEmail(email: string): Promise<number> {
        const sql = `
        SELECT id FROM users WHERE email = "${email}";
        `;
        const rows = await this.query<UserIdRow[]>(sql);
        
        if (rows.length === 0) {
            throw new Error(`User with email ${email} not found`);
        }

        return rows[0].id;
    }


    async solve(user_id: number, question_id: number): Promise<void> {
        const sql = `
        INSERT INTO \`user_quiz\` (\`user_id\`, \`quiz_id\`) VALUES (?, ?);
        `;
        const values = [
            user_id,
            question_id
        ]
        await this.query(sql, values);
    }

    async registerUser(name: string, email: string): Promise<void> {
        ///* 00:18:31 Quiz App quiz */ INSERT INTO `users` (`id`, `name`, `xp`, `email`) VALUES (NULL, 'Roman', '0', 'dauer.roman@me.com');
        const sql = `
        INSERT INTO \`users\` (\`name\`, \`email\`) VALUES (?, ?);
        `;
        const values = [
            name,
            email
        ]
        await this.query(sql, values);
    }

    async like(userId: number, questionId: number): Promise<void> {
        const checkLikeSql = `
            SELECT 1 FROM \`user_likes\`
            WHERE \`user_id\` = ? AND \`quiz_id\` = ?;
        `;
        const existingLike = await this.query<any[]>(checkLikeSql, [userId, questionId]);

        if (existingLike.length > 0) {
            return Promise.reject('User liked already');
        }

        const sql = `
        UPDATE quizzes
        SET likes = likes + 1
        WHERE id = ${questionId};
        `;
        await this.query(sql);

        const sql2 = `
        INSERT INTO \`user_likes\` (\`user_id\`, \`quiz_id\`) VALUES (?, ?);
        `;
        const values = [
            userId,
            questionId
        ];
        await this.query(sql2, values);
        
        const sql3 = `
        DELETE FROM \`user_dislikes\`
        WHERE \`user_id\` = ? AND \`quiz_id\` = ?;
        `;
        await this.query(sql3, values);
        
        const sql4 = `
        UPDATE quizzes
        SET dislikes = dislikes - 1
        WHERE id = ? AND dislikes > 0;
        `;
        await this.query(sql4, [questionId]);
    }

    async getLikes(questionId: number): Promise<number> {
        const sql = `
            SELECT likes FROM quizzes WHERE id = ${questionId};
        `;

        const result = await this.query<any[]>(sql);

        if (result.length > 0) {
        return result[0].likes; 
        } else {
            return Promise.reject(`Couldn't get likes`);
        }
    }

    async getLikesForUser(userId: number): Promise<Question[]> {
        return [];
    }

    async dislike(userId: number, questionId: number): Promise<void> {
        const checkDislikeSql = `
            SELECT 1 FROM \`user_likes\`
            WHERE \`user_id\` = ? AND \`quiz_id\` = ?;
        `;
        const existingLike = await this.query<any[]>(checkDislikeSql, [userId, questionId]);

        if (existingLike.length > 0) {
            return Promise.reject('User disliked already');
        }

        const sql = `
        UPDATE quizzes
        SET dislikes = dislikes + 1
        WHERE id = ${questionId};
        `;
        await this.query(sql);

        const sql2 = `
        INSERT INTO \`user_dislikes\` (\`user_id\`, \`quiz_id\`) VALUES (?, ?);
        `;
        const values = [
            userId,
            questionId
        ];
        await this.query(sql2, values);
        
        const sql3 = `
        DELETE FROM \`user_likes\`
        WHERE \`user_id\` = ? AND \`quiz_id\` = ?;
        `;
        await this.query(sql3, values);
        
        const sql4 = `
        UPDATE quizzes
        SET likes = likes - 1
        WHERE id = ? AND likes > 0;
        `;
        await this.query(sql4, [questionId]);
    }

    async getDislikesForUser(userId: number): Promise<Question[]> {
        return [];
    }

    async getDislikes(questionId: number): Promise<number> {
        const sql = `
            SELECT dislikes FROM quizzes WHERE id = ${questionId};
        `;

        const result = await this.query<any[]>(sql);

        if (result.length > 0) {
        return result[0].likes; 
        } else {
            return Promise.reject(`Couldn't get dislikes`);
        }
    }

    async getUserById(id: number): Promise<User> {
        return {
            id: 0,
            name: 'some username'
        };
    }

    async getQuestionsByTopic(topic: string, language: string): Promise<AIQuestion[]> {
        const sql = `
        SELECT 
        q.*
        FROM quizzes q
        JOIN categories c ON q.category_id = c.category_id
        WHERE c.title = '${topic}' AND q.language = '${language}'
        ORDER BY q.likes
        LIMIT 0, 100;
        `;
        const questions = await this.query<Question[]>(sql).catch(e => {
            console.error(`Failed to get questions by topic ${topic} due to ${e}`);
        });

        if (questions instanceof Array) {
            let result: AIQuestion[] = [];
            for (const q of questions) {
                result.push(DBQuestionToAIQuestion(q));
            }
            return result;
        }
        return [];
    }

    async getQuestions(id: number, topic?: string): Promise<Question[]> {
        const questions: Question[] = await this.query<Question[]>('SELECT * FROM quizzes');
        console.log(`Found ${questions.length} questions`);
        return questions;
    }

    async getTrending(): Promise<Topic[]> {
        return [];
    }

    async getUnsolvedQuizzes(userId: number, language: string, topic: string, difficulty: number): Promise<AIQuestion[]> {
        const sql = `
            SELECT q.*, uq.*
            FROM quizzes q
            JOIN categories c ON q.category_id = c.category_id
            LEFT JOIN user_quiz uq ON uq.quiz_id = q.id AND uq.user_id = ${userId}
            WHERE c.title = '${topic}' AND q.difficulty = ${difficulty} AND c.language = '${language}' AND uq.user_id IS NULL
            ORDER BY q.likes DESC
            LIMIT 0, 10;
        `;

        const questions = await this.query<Question[]>(sql).catch(e => {
            console.error(`Failed to get questions by topic ${topic} due to ${e}`);
        });

        if (questions instanceof Array) {
            let result: AIQuestion[] = [];
            for (const q of questions) {
                result.push(DBQuestionToAIQuestion(q));
            }
            return result;
        }
        return [];
    }

}
