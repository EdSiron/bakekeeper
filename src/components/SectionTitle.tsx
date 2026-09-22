type SectionTitleProps = {
    children: React.ReactNode;
  };
  
  export default function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
      <h3
        className="text-sm uppercase tracking-widest mb-3 pb-2 border-b-2"
        style={{
          fontFamily: "'Mochibop', serif",
          color: "#7a4a33",
          borderColor: "#ffd1dc",
        }}
      >
        {children}
      </h3>
    );
  }