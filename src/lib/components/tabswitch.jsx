import React from 'react';
import styled from 'styled-components';

const TabSwitch = ({ mode = 'card', onChange }) => {
    const checked = mode === 'deck';

    const handleChange = (e) => {
        const newMode = e.target.checked ? 'deck' : 'card';
        onChange?.(newMode);
    };

    return (
        <StyledWrapper>
            <div className="btn-container">
                <label className="switch btn-color-mode-switch">
                    <input
                        id="color_mode"
                        name="color_mode"
                        type="checkbox"
                        checked={checked}
                        onChange={handleChange}
                    />
                    <label className="btn-color-mode-switch-inner" data-off="Card Maker" data-on="Deck Maker" htmlFor="color_mode" />
                </label>
            </div>
        </StyledWrapper>
    );
}

const StyledWrapper = styled.div`
  .btn-container {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    white-space: nowrap;
  }

  .btn-container i {
    display: inline-block;
    position: relative;
    top: -9px;
  }

  .btn-container svg {
    display: inline-block;
    vertical-align: middle;
  }

  label {
    font-size: 13px;
    color: #424242;
    font-weight: 500;
  }

  .btn-color-mode-switch {
    display: inline-block;
    margin: 0px;
    position: relative;
  }

  .btn-color-mode-switch > label.btn-color-mode-switch-inner {
    margin: 0px;
    width: 180px;
    height: 30px;
    background: #ffeef4; /* light pink for before (left) state */
    border-radius: 26px;
    overflow: hidden;
    position: relative;
    transition: all 0.3s ease;
      /*box-shadow: 0px 0px 8px 0px rgba(17, 17, 17, 0.34) inset;*/
    display: block;
  }

  .btn-color-mode-switch > label.btn-color-mode-switch-inner:before {
    content: attr(data-on);
    position: absolute;
    font-size: 13px;
    font-weight: 500;
    top: 50%;
    left: 75%;
    transform: translate(-50%, -50%);
  }

  .btn-color-mode-switch > label.btn-color-mode-switch-inner:after {
    content: attr(data-off);
    width: calc(50% - 6px);
    height: calc(100% - 6px);
    background: #fff;
    border-radius: 26px;
    position: absolute;
    left: 6px;
    top: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    box-shadow: 0px 0px 6px -2px #111;
    padding: 0 8px;
    color: #823746; /* pinkish text for before state */
  }

  .btn-color-mode-switch > .alert {
    display: none;
    background: #FF9800;
    border: none;
    color: #fff;
  }

  .btn-color-mode-switch input[type="checkbox"] {
    cursor: pointer;
    width: 100%;
    height: 100%;
    opacity: 0;
    position: absolute;
    top: 0;
    left: 0;
    z-index: 1;
    margin: 0px;
  }

  .btn-color-mode-switch input[type="checkbox"]:checked + label.btn-color-mode-switch-inner {
    background: #f0ffd9; /* light lime for after (right) state */
  }

  .btn-color-mode-switch input[type="checkbox"]:checked + label.btn-color-mode-switch-inner:after {
    content: attr(data-on);
    left: calc(50%);
    background: #fff;
    color: #356016; /* greenish text when after state */
  }
  .btn-color-mode-switch input[type="checkbox"]:checked + label.btn-color-mode-switch-inner:before {
    content: attr(data-off);
    left: 25%;
    transform: translate(-50%, -50%);
  }

  .btn-color-mode-switch input[type="checkbox"]:checked ~ .alert {
    display: block;
  }

  .dark-preview {
    background: #0d0d0d;
  }

  .white-preview {
    background: #fff;
  }`;

export default TabSwitch;
