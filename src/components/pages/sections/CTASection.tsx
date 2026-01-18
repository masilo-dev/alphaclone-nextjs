import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '../../ui/UIComponents';

const CTASection: React.FC = () => {
    return (
        <section className="py-20 px-4 bg-slate-950">
            <div className="max-w-4xl mx-auto text-center">
                <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to Build Something Great?</h2>
                <p className="text-xl text-slate-400 mb-8">
                    Let's discuss your project and create a solution that drives your business forward
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link href="/contact">
                        <Button size="lg" className="text-lg px-8 py-4">
                            Contact Us <ArrowRight className="w-5 h-5 ml-2 inline" />
                        </Button>
                    </Link>
                    <Link href="/about">
                        <Button variant="outline" size="lg" className="text-lg px-8 py-4">
                            Learn More
                        </Button>
                    </Link>
                </div>
            </div>
        </section>
    );
};

export default CTASection;
