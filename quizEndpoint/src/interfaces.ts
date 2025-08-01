import { RowDataPacket } from "mysql2";

export interface AIQuestion {
    id: number;
    question: string;
    answers: AIAnswer[];
}

export interface AIAnswer {
    text: string;
    correct: boolean;
}

export interface UserIdRow extends RowDataPacket {
    id: number;
}

export interface ConvertedQuestion {
    question: string;
    answer_0: string;
    answer_1: string;
    answer_2: string;
    answer_3: string;
    correct: number;
}

export interface Question extends RowDataPacket {
    id: number;
    question: string;
    dislikes: number;
    likes: number;
    category_id: number;
    answer_0: string;
    answer_1: string;
    answer_2: string;
    answer_3: string;
    correct: number;
}

export interface User {
    id: number;
    name: string;
}

export interface Topic extends RowDataPacket {
    category_id: number;
    title: string;
}
