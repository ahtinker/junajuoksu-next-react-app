import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';

interface BlogCardProps {
    blogId?: number;
}

export default function BlogCard({ blogId = 1 }: BlogCardProps) {

    const t = useTranslations();

    return (
        <div className="card " style={{ backgroundColor: "var(--bulma-background)" }}>
            <div className="card-image">
                <figure className="image is-4by1">
                    <Image
                        src={t(`blogs.blog${blogId}.image`)}
                        alt="Blog cover image"
                        height={200}
                        width={800}
                        style={{ objectFit: 'cover' }}
                    />
                </figure>
            </div>
            <div className="card-content">
                <h3 className="title is-size-5" style={{ color: "var(--bulma-text-strong)" }}>{t(`blogs.blog${blogId}.title`)}</h3>
                <div className="content">
                    {t(`blogs.blog${blogId}.description`)}
                </div>
            </div>
            <footer className="card-footer">
                <Link href={`/blog/${blogId}`} className="card-footer-item">
                    <span>
                        Lue opas
                    </span>
                    <span className="icon">
                        <i className="fas fa-chevron-right"></i>
                    </span>
                </Link>

            </footer>
        </div>
    );
}   