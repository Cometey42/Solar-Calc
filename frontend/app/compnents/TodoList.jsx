"use client";
import React, { useReducer, useState } from "react";



function todoReducer(state, action) {
    switch (action.type) {
        case "add":
            return [...state, { text: action.text, done: false }];
        case "toggle":
            return state.map((todo, idx) =>
                idx === action.inx ? { ...todo, done: !todo.done } : todo
            );
        case "remove":
            return state.filter((_, idx) => idx !== action.idx);
        default:
            throw new Error("Unknown action");
    }
}


export default function TodoList() {
    const [todos, dispatch] = useReducer(todoReducer, []);
    const [input, setInput] = useState("");

    return (
        <div className="p-2 border rounded">
            <h2>Todo List (useReducer Example)</h2>
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Add a new todo"
            />
            <button
                onClick={() => {
                    dispatch({ type: "add", text: input });
                    setInput("");
                }}
            >
                Add
            </button>
            <ul>
                {todos.map((todo, idx) => (
                    <li key={idx}>
                        <span
                            style={{
                                textDecoration: todo.done ? "line-through" : "none",
                                cursor: "pointer",
                            }}
                            onClick={() => dispatch({ type: "toggle", inx: idx })}
                        >
                            {todo.text}
                        </span>
                        <button onClick={() => dispatch({ type: "remove", idx })}>
                            Remove
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}