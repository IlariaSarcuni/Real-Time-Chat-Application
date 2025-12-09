/* An horizontal line with some centered text */
function LineSeparator({children}) {
    return (
        <div className="line-separator">
            <span>{children}</span>
        </div>
    )
}

export default LineSeparator;