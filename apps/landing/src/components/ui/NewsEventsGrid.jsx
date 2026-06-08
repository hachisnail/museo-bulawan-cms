import React from 'react';

export const NewsEventsGrid = ({ articles = [], cmsUrl = '' }) => {
  const displayArticles = articles.slice(0, 4);
  const count = displayArticles.length;

  if (count === 0) {
    return (
      <div className="w-full text-center py-12 text-gray-500 font-light text-lg">
        No articles published yet. Check back soon!
      </div>
    );
  }

  // Helper to resolve cover image URL
  const getCoverUrl = (article) => {
    if (article.coverImage?.sizes?.card?.url) {
      return `${cmsUrl}${article.coverImage.sizes.card.url}`;
    }
    if (article.coverImage?.url) {
      if (article.coverImage.url.startsWith('http')) return article.coverImage.url;
      return `${cmsUrl}${article.coverImage.url}`;
    }
    return ''; // placeholder fallback handled in CSS
  };

  // Helper to format date
  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (e) {
      return '';
    }
  };

  // Determine grid container class based on count
  let containerClass = "grid gap-6 md:gap-10 w-full min-h-0";
  if (count === 1) {
    containerClass += " grid-cols-1 max-w-4xl mx-auto";
  } else if (count === 2) {
    containerClass += " grid-cols-1 lg:grid-cols-2";
  } else if (count === 3) {
    containerClass += " grid-cols-1 lg:grid-cols-3";
  } else {
    containerClass += " grid-cols-1 lg:grid-cols-2";
  }

  return (
    <div className={containerClass}>
      {displayArticles.map((article, index) => {
        // Dynamic classes based on card count to keep layout balanced
        let itemClass = "flex flex-col sm:flex-row gap-5 md:gap-6 group transition-all duration-300";
        let imgWrapperClass = "w-full sm:w-[140px] md:w-[180px] lg:w-[200px] shrink-0 aspect-square bg-cover bg-center object-cover border border-white/5 transition-transform duration-500 group-hover:scale-[1.02] bg-gray-800";
        let textContainerClass = "flex flex-col py-1 justify-center flex-1";

        if (count === 1) {
          // Large featured hero card if there's only 1 article
          itemClass = "flex flex-col lg:flex-row gap-8 lg:gap-12 group transition-all duration-300 w-full bg-white/[0.02] p-6 md:p-8 border border-white/5 rounded-sm";
          imgWrapperClass = "w-full lg:w-[50%] shrink-0 aspect-[16/10] bg-cover bg-center object-cover border border-white/5 transition-transform duration-500 group-hover:scale-[1.01] bg-gray-800";
          textContainerClass = "flex flex-col py-2 justify-center flex-1";
        } else if (count === 3) {
          if (index === 0) {
            // First item takes 2/3 of the layout in lg size
            itemClass = "flex flex-col sm:flex-row lg:flex-col gap-5 md:gap-6 group transition-all duration-300 lg:col-span-2 bg-white/[0.02] p-5 border border-white/5 rounded-sm";
            imgWrapperClass = "w-full sm:w-[200px] lg:w-full lg:aspect-[16/9] shrink-0 bg-cover bg-center object-cover border border-white/5 transition-transform duration-500 group-hover:scale-[1.01] bg-gray-800";
            textContainerClass = "flex flex-col py-2 justify-center flex-1";
          } else {
            // Other two stack in the remaining 1/3 column
            itemClass = "flex flex-col sm:flex-row lg:flex-col gap-4 group transition-all duration-300 bg-white/[0.01] p-4 border border-white/5 rounded-sm lg:col-span-1";
            imgWrapperClass = "w-full sm:w-[120px] lg:w-full lg:aspect-[16/10] shrink-0 bg-cover bg-center object-cover border border-white/5 transition-transform duration-500 group-hover:scale-[1.01] bg-gray-800";
            textContainerClass = "flex flex-col justify-center py-1 flex-1";
          }
        }

        return (
          <a
            key={article.id || index}
            href={`/articles/${article.slug || article.id || ''}`}
            className={itemClass}
          >
            <div
              className={imgWrapperClass}
              style={{ backgroundImage: getCoverUrl(article) ? `url('${getCoverUrl(article)}')` : 'none' }}
            />

            <div className={textContainerClass}>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="bg-[#EFBF04]/10 text-[#EFBF04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-sm">
                  {article.category?.name || 'News'}
                </span>
                <span className="text-gray-500 text-xs">
                  {formatDate(article.publishedAt)}
                </span>
              </div>
              <h3 className="text-lg md:text-xl font-bold text-white uppercase leading-snug mb-3 group-hover:text-[#EFBF04] transition-colors line-clamp-2">
                {article.title}
              </h3>
              <p className="text-gray-400 text-xs md:text-sm leading-relaxed line-clamp-3 md:line-clamp-4">
                {article.excerpt || 'Read the full article to learn more.'}
              </p>
            </div>
          </a>
        );
      })}
    </div>
  );
};
