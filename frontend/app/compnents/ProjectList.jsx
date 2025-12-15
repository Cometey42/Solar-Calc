

import {useFetch} from './useFetch';

export default function ProjectList() {
    const { data, loading, error } = useFetch('/projects');

    if (loading) return <p>Loading projects...</p>;
    if (error) return <p>Error loading projects.</p>;
    if (!data) return null;

    return (
        <ul>
            {data.map((project) => {
                <li key={project.id}>{project.name}</li>
            })}
        </ul>
    );
};