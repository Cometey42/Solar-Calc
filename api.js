const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function fetchProjects(page = 1, perPage = 10) {

    return fetch(`${API_BASE_URL}/compare/projects?page=${page}&per_page=${perPage}`)
        .then((res) => {
            if (!res.ok) {
                throw new Error("Failed to fetch projects");
            }
            return res.json();

        });

}


