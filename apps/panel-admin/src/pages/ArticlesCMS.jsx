import React from 'react';

export default function ArticlesCMS() {
    return (
        <div className="flex-1 h-full flex flex-col -m-4 sm:-m-6 lg:-m-8">
            <iframe 
                src="http://localhost:3001/admin/collections/articles" 
                className="w-full h-full flex-1 border-0"
                title="Payload CMS Editor"
            />
        </div>
    );
}
