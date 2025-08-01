import { Context, APIGatewayEvent } from 'aws-lambda';
import { AI } from './AI';
import { Database } from './Database';

export const funFact = async (event: APIGatewayEvent, context: Context) => {
    let ai = new AI();
    let topic = event.queryStringParameters?.topic;
    let languageCode = event.queryStringParameters?.language;

    if (topic && languageCode) {
        const rsp = await ai.getFunFacts(topic, languageCode)
            .catch(e => {
                return {
                    statusCode: 500,
                    body: JSON.stringify(e),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            });

        return {
            statusCode: 200,
            body: JSON.stringify(rsp),
            headers: {
                'Content-Type': 'application/json'
            }
        }
    }
    return {
        statusCode: 400,
        body: 'Bad request',
        headers: {
            'Content-Type': 'application/json'
        }
    }
}

export const emoji = async (event: APIGatewayEvent, context: Context) => {
    let ai = new AI();
    let topic = event.queryStringParameters?.topic;

    if (topic) {
        const rsp = await ai.getEmoji(topic)
            .catch(e => {
                return {
                    statusCode: 500,
                    body: JSON.stringify(e),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            });

        return {
            statusCode: 200,
            body: JSON.stringify(rsp),
            headers: {
                'Content-Type': 'application/json'
            }
        }
    }
    return {
        statusCode: 400,
        body: 'Bad request',
        headers: {
            'Content-Type': 'application/json'
        }
    }
}

export const explain = async (event: APIGatewayEvent, context: Context) => {
    let ai = new AI();
    let question = event.queryStringParameters?.question;
    let userAnswer = event.queryStringParameters?.userAnswer;
    let answer = event.queryStringParameters?.answer;
    let languageCode = event.queryStringParameters?.language;

    if (question && answer && userAnswer && languageCode) {
        const rsp = await ai.getExplanation(question, answer, userAnswer, languageCode)
            .catch(e => {
                return {
                    statusCode: 500,
                    body: JSON.stringify(e),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            });

        return {
            statusCode: 200,
            body: JSON.stringify(rsp),
            headers: {
                'Content-Type': 'application/json'
            }
        }
    }
    return {
        statusCode: 400,
        body: 'Bad request',
        headers: {
            'Content-Type': 'application/json'
        }
    }
}

export const solve = async (event: APIGatewayEvent, context: Context) => {
    const email = event.requestContext?.authorizer?.claims.email;
    if (!email) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                error: `Unknown user`,
                claims: event.requestContext?.authorizer?.claims
            }),
            headers: {
                'Content-Type': 'application/json'
            }
        }
    }
    const quizParam = event.queryStringParameters?.quizId;
    if (!quizParam) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: `Bad Request`,
                claims: event.requestContext?.authorizer?.claims
            }),
            headers: {
                'Content-Type': 'application/json'
            }
        }
    }
    const quizId = parseInt(quizParam);
    const db = new Database();
    const userId = await db.getUserIdForEmail(email);
    await db.solve(userId, quizId);
    await db.shutdown();
    return {
        statusCode: 200,
        body: "OK",
        headers: {
                'Content-Type': 'application/json'
            }
    };
};

export const quiz = async (event: APIGatewayEvent, context: Context) => {
    const ai = new AI();
    const topic = event.queryStringParameters?.topic;
    const difficultyTmp = event.queryStringParameters?.difficulty;
    const languageCode = event.queryStringParameters?.languageCode;
    const email = event.requestContext?.authorizer?.claims.email;

    if (!email) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                error: `Unknown user`,
                claims: event.requestContext?.authorizer?.claims
            }),
            headers: {
                'Content-Type': 'application/json'
            }
        }
    }
    const db = new Database();
    const userId = await db.getUserIdForEmail(email);
    await db.shutdown();

    if (userId && topic && difficultyTmp && languageCode) {
        const difficulty = parseInt(difficultyTmp);
        const rsp = await ai.getQuiz(`${userId}`, topic, difficulty, languageCode)
            .catch(e => {
                return {
                    statusCode: 500,
                    body: JSON.stringify(e),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            });

        return {
            statusCode: 200,
            body: JSON.stringify(rsp),
            headers: {
                'Content-Type': 'application/json'
            }
        }
    }
    return {
        statusCode: 400,
        body: 'Bad request',
        headers: {
            'Content-Type': 'application/json'
        }
    }
}

// https://c0jlmlvl6d.execute-api.eu-central-1.amazonaws.com/Prod/quiz?topic=Wikipedia&difficulty=0&userId=0&language=en
// https://c0jlmlvl6d.execute-api.eu-central-1.amazonaws.com/Prod/quiz?topic=Europa&userId=2&difficulty=2&languageCode=de