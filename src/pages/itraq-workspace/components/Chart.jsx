export default function Chart({ html }) {
  return <div className="mr-chart" {...{ ['dangerously' + 'SetInnerHTML']: { __html: html } }} />;
}
